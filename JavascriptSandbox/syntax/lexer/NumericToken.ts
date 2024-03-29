/// <reference path="Lexer.ts" />
/// <reference path="NumericTokenKind.ts" />
'use strict';

class NumericToken implements Token {
	public type : TokenType;

	constructor (
		public kind : number,
		public value : any,
		public loc : SourceLocation,
		public prev : Token = null,
		public next : Token = null
	) {
		this.type = TokenType.NumericLiteral;

		if ( this.prev !== null )
			this.prev.next = this;
	}

	public static read ( lexer : Lexer ) {
		var start = lexer.index,
			cc = Lexer.builtin.charCodeAt.call ( lexer.code, lexer.index ),
			maybeOctal : boolean;

		if ( Lexer.DEBUG )
			System.assert ( cc >= 0x30 /*0*/ && cc <= 0x39 /*9*/ );

		lexer.index++;
		
		if ( lexer.index >= lexer.length )
			maybeOctal = false;
		else {
			maybeOctal = cc === 0x30 /*0*/;
			cc = Lexer.builtin.charCodeAt.call ( lexer.code, lexer.index );

			if ( maybeOctal ) {
				if ( cc === 0x78 /*x*/ || cc === 0x58 /*X*/ )
					return	NumericToken.readHexLiteral ( lexer, start );
				else if ( cc === 0x2e /*.*/ )
					return	NumericToken.readFractionLiteral ( lexer, start );
				else if ( cc === 0x65 /*e*/ || cc === 0x45 /*E*/ )
					return	NumericToken.readExponentLiteral ( lexer, start );
			}

			while ( lexer.index < lexer.length ) {
				if ( cc < 0x30 /*0*/ || cc > 0x39 /*9*/ ) {
					if ( maybeOctal ) {
						// Yes, it is octal.
						break;
					} else {
						if ( cc === 0x2e /*.*/ )
							return	NumericToken.readFractionLiteral ( lexer, start );
						else if ( cc === 0x65 /*e*/ || cc === 0x45 /*E*/ )
							return	NumericToken.readExponentLiteral ( lexer, start );
						else
							break;
					}
				} else if ( maybeOctal )
					maybeOctal = cc < 0x38 /*8*/;

				cc = Lexer.builtin.charCodeAt.call ( lexer.code, ++lexer.index );
			}

			if ( maybeOctal && lexer.index - start === 1 ) {
				// We've got '0' string, it's not octal number.
				maybeOctal = false;
			}
		}

		// We've got an integer.
		var numberString = Lexer.builtin.substring.call ( lexer.code, start, lexer.index ),
			value = Lexer.builtin.parseInt ( numberString, maybeOctal ? 8 : 10 );

		return	new NumericToken (
			maybeOctal ? NumericTokenKind.Octal : NumericTokenKind.Integer,
			value,
			{
				source : lexer.sourcePath,
				start : {
					line : lexer.line,
					column : start - lexer.lineStartIndex,
					index : start
				},
				end : {
					line : lexer.line,
					column : lexer.index - lexer.lineStartIndex,
					index : lexer.index
				},
			},
			lexer.token
		);
	}

	private static readHexLiteral ( lexer : Lexer, start : number ) {
		if ( Lexer.DEBUG )
			System.assert ( lexer.code [lexer.index] === 'x' || lexer.code [lexer.index] === 'X' );

		lexer.index++;

		var partStart = lexer.index,
			value = NumericToken.readHex ( lexer );

		return	new NumericToken (
			NumericTokenKind.Hexadecimal,
			value,
			{
				source : lexer.sourcePath,
				start : {
					line : lexer.line,
					column : start - lexer.lineStartIndex,
					index : start
				},
				end : {
					line : lexer.line,
					column : lexer.index - lexer.lineStartIndex,
					index : lexer.index
				},
			},
			lexer.token
		);
	}
	
	public static readHex ( lexer : Lexer, length? : number ) {
		var start = lexer.index,
			end : number,
			finite = typeof length !== 'undefined';
		
		if ( finite ) {
			end = lexer.index + length;

			if ( end > lexer.length )
				end = lexer.length;
		} else
			end = lexer.length;

		while ( lexer.index < end ) {
			var cc = Lexer.builtin.charCodeAt.call ( lexer.code, lexer.index );
			/* Valid ranges:
			 * 0x30..0x39 ∪ 0x41..0x46 ∪ 0x61..0x66
			 *    ^  ^         ^  ^          ^  ^
			 *    0..9         A..F          a..f
			 */

			if ( !(
				( cc >= 0x30 /*0*/ && cc <= 0x39 /*9*/ ) ||
				( cc >= 0x61 /*a*/ && cc <= 0x66 /*f*/ ) ||
				( cc >= 0x41 /*A*/ && cc <= 0x46 /*F*/ )
			) ) {
				break;
			} else
				lexer.index++;
		}

		if ( lexer.index === start ||
			( finite && ( lexer.index - start !== length ) ) )
		{
			var expectation = finite ? length + ' hexadecimal characters' : null;
			lexer.throwEofOrIllegal ( 'hex escape', expectation );
		}

		var numberString = Lexer.builtin.substring.call ( lexer.code, start, lexer.index );
		
		return	Lexer.builtin.parseInt ( numberString, 16 );
	}

	public static readFractionLiteral ( lexer : Lexer, start : number ) {
		if ( Lexer.DEBUG )
			System.assert ( lexer.code [lexer.index] === '.' );

		lexer.index++;

		while ( lexer.index < lexer.length ) {
			var cc = Lexer.builtin.charCodeAt.call ( lexer.code, lexer.index );
			
			if ( cc === 0x65 /*e*/ || cc === 0x45 /*E*/ )
				return	NumericToken.readExponentLiteral ( lexer, start );
			else if ( cc < 0x30 /*0*/ || cc > 0x39 /*9*/ )
				break;
			
			lexer.index++;
		}

		var numberString = Lexer.builtin.substring.call ( lexer.code, start, lexer.index ),
			value = Lexer.builtin.parseFloat ( numberString );
		
		return	new NumericToken (
			NumericTokenKind.Fractional,
			value,
			{
				source : lexer.sourcePath,
				start : {
					line : lexer.line,
					column : start - lexer.lineStartIndex,
					index : start
				},
				end : {
					line : lexer.line,
					column : lexer.index - lexer.lineStartIndex,
					index : lexer.index
				},
			},
			lexer.token
		);
	}

	private static readExponentLiteral ( lexer : Lexer, start : number ) {
		if ( Lexer.DEBUG )
			System.assert ( lexer.code [lexer.index] === 'e' || lexer.code [lexer.index] === 'E' );

		lexer.index++;
		var partStart = lexer.index;

		if ( lexer.index < lexer.length ) {
			var cc = Lexer.builtin.charCodeAt.call ( lexer.code, lexer.index++ );

			if ( cc === 0x2d /*-*/ || cc === 0x2b /*+*/ )
				partStart = lexer.index;
			else if ( cc < 0x30 /*0*/ || cc > 0x39 /*9*/ ) {
				lexer.index--;
				Lexer.surprise (
					lexer.illegalCharToken,
					'numeric token exponent',
					'decimal digit'
				);
			}

			while ( lexer.index < lexer.length ) {
				var cc = Lexer.builtin.charCodeAt.call ( lexer.code, lexer.index++ );
			
				if ( cc < 0x30 /*0*/ || cc > 0x39 /*9*/ ) {
					lexer.index--;
					break;
				}
			}
		}

		if ( lexer.index === partStart )
			lexer.throwEofOrIllegal ( 'numeric token exponent' );

		var numberString = Lexer.builtin.substring.call ( lexer.code, start, lexer.index ),
			value = Lexer.builtin.parseFloat ( numberString );
		
		return	new NumericToken (
			NumericTokenKind.Exponential,
			value,
			{
				source : lexer.sourcePath,
				start : {
					line : lexer.line,
					column : start - lexer.lineStartIndex,
					index : start
				},
				end : {
					line : lexer.line,
					column : lexer.index - lexer.lineStartIndex,
					index : lexer.index
				},
			},
			lexer.token
		);
	}
}

System.breakPrototypeChain ( NumericToken );