using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.IO;
using System.Text.RegularExpressions;

namespace GenLexerRegex {
	class Program {
		// Char codes by unicode categories.
		static Dictionary <string, HashSet <int>> ccByCat = new Dictionary <string, HashSet <int>> ();

		static void Main ( string [] args ) {
			InitApp ();
			LoadData ();

			HashSet <int>
				Lu = ccByCat ["Lu"],	// Uppercase letter
				Ll = ccByCat ["Ll"],	// Lowercase letter
				Lt = ccByCat ["Lt"],	// Titlecase letter
				Lm = ccByCat ["Lm"],	// Modifier letter
				Lo = ccByCat ["Lo"],	// Other letter
				Nl = ccByCat ["Nl"],	// Letter number
				unicodeLetter = new HashSet <int> (
					Lu
					.Concat ( Ll )
					.Concat ( Lt )
					.Concat ( Lm )
					.Concat ( Lo )
					.Concat ( Nl )
				),
				dollarSign = toCcList ( '$' ),
				underscore = toCcList ( '_' ),
				identifierStart = new HashSet <int> (
					unicodeLetter
					.Concat ( dollarSign )
					.Concat ( underscore )
				),
				Mn = ccByCat ["Mn"],	// Non-spacing mark
				Mc = ccByCat ["Mc"],	// Combining spacing mark
				unicodeCombiningMark = new HashSet <int> ( Mn.Concat ( Mc ) ),
				Nd = ccByCat ["Nd"],	// Decimal number
				unicodeDigit = Nd,
				Pc = ccByCat ["Pc"],	// Connector punctuation
				unicodeConnectorPunctuation = Pc,
				zwnj = new HashSet <int> { 0x200C },
				zwj = new HashSet <int> { 0x200D },
				identifierPart = new HashSet <int> (
					identifierStart
					.Concat ( unicodeCombiningMark )
					.Concat ( unicodeDigit )
					.Concat ( unicodeConnectorPunctuation )
					.Concat ( zwnj )
					.Concat ( zwj )
				),
				unicodeSpaceSeparator = ccByCat ["Zs"];	// Unicode space separator
			
			string nonAsciiIdentifierStartJsPattern = generateJsPattern ( identifierStart, 0x80 );
            string nonAsciiIdentifierPartJsPattern = generateJsPattern ( identifierPart, 0x80 );
			string nonAsciiUnicodeSpaceSeparatorPattern = generateJsPattern ( unicodeSpaceSeparator, 0x100 );

            Console.WriteLine ( "var nonAsciiIdentifierStartRegex = /[" + nonAsciiIdentifierStartJsPattern + "]/;" );
			Console.WriteLine ( "var nonAsciiIdentifierPartRegex = /[" + nonAsciiIdentifierPartJsPattern + "]/;" );
			Console.WriteLine ( "var nonAsciiUnicodeSpaceSeparatorRegex = /[" + nonAsciiUnicodeSpaceSeparatorPattern + "]/;" );
		}

		private static string generateJsPattern ( HashSet <int> ccList, int minCc = int.MinValue, int maxCc = int.MaxValue ) {
			string pattern = "";
			bool inRange = false;
			int rangeStart = 0, rangeEnd = 0;

			for ( int cc = 0 ; cc < 0xffff ; cc++ ) {
				if ( cc < minCc || cc > maxCc )
					continue;

				if ( ccList.Contains ( cc ) ) {
					if ( inRange )
						rangeEnd = cc;
					else {
						rangeStart = rangeEnd = cc;
						inRange = true;
					}
				} else {
					if ( inRange )
						pattern += toPatternRangeString ( rangeStart, rangeEnd );

					inRange = false;
				}
			}

			if ( inRange )
				pattern += toPatternRangeString ( rangeStart, rangeEnd );

			return	pattern;
		}

		private static string toPatternRangeString ( int start, int end ) {
			if ( end - start == 1 )
				return	escapeChar ( start ) + escapeChar ( end );
			else if ( start != end )
				return	escapeChar ( start ) + "-" + escapeChar ( end );
			else
				return	escapeChar ( start );
		}

		private static string escapeChar ( int cc ) {
			if ( cc <= 0xff )
				return	@"\x" + cc.ToString ( "x2" );
			else
				return	@"\u" + cc.ToString ( "x4" );
		}

		static HashSet <int> toCcList ( char ch ) {
			int cc = char.ConvertToUtf32 ( ch.ToString (), 0 );

			return	new HashSet <int> { cc };
		}

		static void InitApp () {
			string curDir = Environment.CurrentDirectory;

			if ( curDir.EndsWith ( "Debug" ) || curDir.EndsWith ( "Release" ) ) {
				Environment.CurrentDirectory = Path.Combine ( curDir, "../../" );
			}
		}

		const string DataDirName = "Data";
		const string CategoryDataFileName = "DerivedGeneralCategory.txt";
		static Regex rangeRegex = new Regex ( @"(?<Start>[\dA-F]{4,6})(?:\.\.(?<End>[\dA-F]{4,6}))?\s+;\s+(?<CatAcronym>\w+)" );

		static void LoadData () {
			string fileName = Path.Combine ( DataDirName, CategoryDataFileName );

			using ( StreamReader reader = new StreamReader ( fileName ) ) {
				while ( !reader.EndOfStream ) {
					string line = reader.ReadLine ();

					if ( line.StartsWith ( "#" ) )	// Skip comment
						continue;

					// Sample: "0378..0379    ; Cn #   [2] <reserved-0378>..<reserved-0379>"
					var m = rangeRegex.Match ( line );

					if ( m.Success ) {
						int start = Convert.ToInt32 ( m.Groups ["Start"].Value, 16 );

						if ( start > 0xffff )
							continue;

						int end = start;
						var endGroup = m.Groups ["End"];

						if ( endGroup.Success ) {
							end = Convert.ToInt32 ( m.Groups ["End"].Value, 16 );
						}

						if ( end > 0xffff )
							end = 0xffff;

						string cat = m.Groups ["CatAcronym"].Value;
						HashSet <int> catCcSet;

						if ( !ccByCat.TryGetValue ( cat, out catCcSet ) ) {
							catCcSet = new HashSet <int> ();
							ccByCat [cat] = catCcSet;
						}

						for ( int cc = start ; cc <= end ; cc++ ) {
							catCcSet.Add ( cc );
						}
					}
				}
			}
		}
	}
}
