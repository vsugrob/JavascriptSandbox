/// <reference path="Lexer.ts" />
'use strict';

interface RegexPrecedingWordMap {
	[reservedWord : string] : boolean;
}

class RegexToken implements Token {
	public type : TokenType;

	constructor (
		public kind : number,
		public value : any,
		public loc : SourceLocation,
		public prev : Token = null,
		public next : Token = null
	) {
		this.type = TokenType.RegularExpression;

		if ( this.prev !== null )
			this.prev.next = this;
	}

	public static read ( lexer : Lexer ) {
		if ( Lexer.DEBUG ) {
			System.assert (
				lexer.code [lexer.index] === '/' &&
				lexer.code [lexer.index + 1] !== '/' &&
				lexer.code [lexer.index + 1] !== '*'
			);
		}

		var start = lexer.index++,
			patternStart = lexer.index,
			patternEnd : number,
			isTerminated = false,
			inCharClass = false,
			cc : number;

		while ( lexer.index < lexer.length ) {
			cc = Lexer.builtin.charCodeAt.call ( lexer.code, lexer.index );

			if ( cc === 0x2f /*/*/ && !inCharClass ) {
				isTerminated = true;
				lexer.index++;
				break;
			} else if ( cc === 0x5c /*\*/ ) {
				if ( ++lexer.index >= lexer.length )
					break;

				cc = Lexer.builtin.charCodeAt.call ( lexer.code, lexer.index );

				if ( cc === 0x2f /*/*/ || cc === 0x5c /*\*/ ||
					 cc === 0x5b /*[*/ ||
					 ( inCharClass && cc === 0x5d /*]*/ )
				) {
					// Consume as part of escape sequence.
					lexer.index++;
				}

				continue;
			} else if ( cc === 0x5b /*[*/ )
				inCharClass = true;
			else if ( cc === 0x5d /*]*/ && inCharClass )
				inCharClass = false;
			else if ( cc === 0xa /*<LF>*/ || cc === 0xd /*<CR>*/ ||
						cc === 0x2028 /*LINE SEPARATOR <LS>*/ ||
						cc === 0x2029 /*PARAGRAPH SEPARATOR <PS>*/ )
			{
				break;
			}

			/* As you can see there was no special handling code for
			 * RegularExpressionClass. We're leaving this to native regex parses of
			 * the environment we running in because it will interpret regex pattern
			 * according to its own, more stringent grammar and in case of error
			 * it will produce more helpful error description than we could. */

			lexer.index++;
		}

		if ( !isTerminated )
			lexer.throwEofOrIllegal ( 'regular expression', 'terminator character /' );
		else
			patternEnd = lexer.index - 1;	// Step behind closing '/' regex delimiter.

		var flags = '';

		if ( lexer.index < lexer.length ) {
			cc = Lexer.builtin.charCodeAt.call ( lexer.code, lexer.index );

			if ( IdentifierToken.isIdStart ( cc ) ) {
				flags = IdentifierToken.readValue ( lexer );
				
				if ( !lexer.allowEscapeSequenceInRegexFlags && IdentifierToken.hasEscapeSeqs ) {
					lexer.jump ( lexer.token );	// Set position to start of identifier.
					Lexer.syntaxError (
						lexer.illegalCharToken,
						'Escape sequences are not allowed in RegExp flags'
					);
				} else {
					var global, ignoreCase, multiline,
						valid = true;

					for ( var i = 0 ; i < flags.length ; i++ ) {
						cc = Lexer.builtin.charCodeAt.call ( flags, i );

						if ( cc === 0x67 /*g*/ ) {
							if ( global ) { valid = false; break; }
							else global = true;
						} else if ( cc === 0x69 /*i*/ ) {
							if ( ignoreCase ) { valid = false; break; }
							else ignoreCase = true;
						} else if ( cc === 0x6d /*m*/ ) {
							if ( multiline ) { valid = false; break; }
							else multiline = true;
						} else {
							valid = false;
							break;
						}
					}

					if ( !valid ) {
						lexer.jump ( lexer.token );	// Set position to start of identifier.
						Lexer.syntaxError (
							lexer.illegalCharToken,
							'Invalid flags supplied to RegExp constructor "' + flags + '"'
						);
					}
				}
			}
		}

		var pattern = Lexer.builtin.substring.call ( lexer.code, patternStart, patternEnd ),
			regexObject = new Lexer.builtin.RegExp ( pattern, flags );

		return	new RegexToken (
			-1,	// kind
			regexObject,
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

	// This was derived from Docs/division-or-regex-preceding-tokens.txt
	public static regexPrecedingWords = <RegexPrecedingWordMap> System.toFrozenMap ( {
		'case' : true,
		'delete' : true,
		'do' : true,
		'else' : true,
		'in' : true,
		'instanceof' : true,
		'new' : true,
		'return' : true,
		'throw' : true,
		'typeof' : true,
		'void' : true,
		'yield' : true,
	} );
}

System.breakPrototypeChain ( RegexToken );