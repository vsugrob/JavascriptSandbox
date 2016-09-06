/// <reference path="Lexer.ts" />
/// <reference path="StringTokenKind.ts" />
'use strict';

class StringToken implements Token {
	public type : TokenType;

	constructor (
		public kind : number,
		public value : any,
		public loc : SourceLocation,
		public prev : Token = null,
		public next : Token = null
	) {
		this.type = TokenType.StringLiteral;

		if ( this.prev !== null )
			this.prev.next = this;
	}

	public static read ( lexer : Lexer ) {
		var startIndex = lexer.index,
			startLine = lexer.line,
			cc = Lexer.builtin.charCodeAt.call ( lexer.code, lexer.index++ ),
			quoteCc = cc,
			str = '',
			withOctalEscSeq = false,
			valid = false;

		if ( Lexer.DEBUG )
			System.assert ( quoteCc === 0x27 /*'*/ || quoteCc === 0x22 /*"*/ );

		while ( lexer.index < lexer.length ) {
			cc = Lexer.builtin.charCodeAt.call ( lexer.code, lexer.index++ );

			if ( cc === quoteCc ) {
				valid = true;
				break;
			} else if ( cc === 0x5c /*\*/ ) {
				if ( lexer.index >= lexer.length )
					break;

				cc = Lexer.builtin.charCodeAt.call ( lexer.code, lexer.index++ );

				if ( cc === 0x62 /*b*/ ) {	// backspace <BS>
					str += '\b';
				} else if ( cc === 0x74 /*t*/ ) {	// horizontal tab <HT>
					str += '\t';
				} else if ( cc === 0x6e /*n*/ ) {	// line feed (new line) <LF>
					str += '\n';
				} else if ( cc === 0x76 /*v*/ ) {	// vertical tab <VT>
					str += '\v';
				} else if ( cc === 0x66 /*f*/ ) {	// form feed <FF>
					str += '\f';
				} else if ( cc === 0x72 /*r*/ ) {	// carriage return <CR>
					str += '\r';
				} else if ( cc === 0x78 /*x*/ ) {	// hex escape sequence
					cc = NumericToken.readHex ( lexer, 2 );
					str += Lexer.builtin.fromCharCode ( cc );
				} else if ( cc === 0x75 /*u*/ ) {	// unicode escape sequence
					cc = NumericToken.readHex ( lexer, 4 );
					str += Lexer.builtin.fromCharCode ( cc );
				} else if ( cc >= 0x30 /*0*/ && cc < 0x38 /*8*/ ) {	// Octal escape sequence or '\0'
					if ( lexer.index >= lexer.length )
						break;

					var cc2 = Lexer.builtin.charCodeAt.call ( lexer.code, lexer.index );

					if ( cc2 >= 0x30 /*0*/ && cc2 < 0x38 /*8*/ ) {
						withOctalEscSeq = true;
						var octalCc = ( cc - 0x30 /*0*/ << 3 ) + cc2 - 0x30 /*0*/;
						lexer.index++;
						
						if ( cc < 0x34 /*4*/ ) {
							if ( lexer.index >= lexer.length )
								break;

							var cc3 = Lexer.builtin.charCodeAt.call ( lexer.code, lexer.index );

							if ( cc3 >= 0x30 /*0*/ && cc3 < 0x38 /*8*/ ) {
								// It's a three-character long octal escape sequence.
								octalCc = ( octalCc << 3 ) + cc3 - 0x30 /*0*/;
								lexer.index++;
							} // else: it's a 2-char octal escape sequence.
						} // else: it's a 2-char octal escape sequence.

						str += Lexer.builtin.fromCharCode ( octalCc );
					} else if ( cc === 0x30 /*0*/ )	// It's a null terminator.
						str += '\0';
					else {	// Single-character octal escape sequence.
						withOctalEscSeq = true;
						str += Lexer.builtin.fromCharCode ( cc - 0x30 /*0*/ );
					}
				} else {
					var lineTerminatorSeq = false;

					if ( cc === 0xa /*<LF>*/ ||
						 cc === 0x2028 /*LINE SEPARATOR <LS>*/ ||
						 cc === 0x2029 /*PARAGRAPH SEPARATOR <PS>*/ )
					{
						lineTerminatorSeq = true;
					} else if ( cc === 0xd /*<CR>*/ ) {
						if ( lexer.index >= lexer.length )
							break;

						cc = Lexer.builtin.charCodeAt.call ( lexer.code, lexer.index );

						if ( cc === 0xa /*<LF>*/ )
							lexer.index++;

						lineTerminatorSeq = true;
					}

					if ( lineTerminatorSeq )
						lexer.newline ( lexer.index );
					else {
						// We've got NonEscapeCharacter (See Docs/Ecma-262.pdf, 7.8.4).
						str += Lexer.builtin.fromCharCode ( cc );
					}
				}
			} else if ( cc === 0xa /*<LF>*/ || cc === 0xd /*<CR>*/ ||
						cc === 0x2028 /*LINE SEPARATOR <LS>*/ ||
						cc === 0x2029 /*PARAGRAPH SEPARATOR <PS>*/ )
			{
				lexer.index--;
				Lexer.surprise ( lexer.illegalCharToken, 'string literal' );
			} else
				str += Lexer.builtin.fromCharCode ( cc );
		}

		if ( !valid )
			lexer.throwEofOrIllegal ( 'string literal' );

		return	new StringToken (
			withOctalEscSeq ? StringTokenKind.WithOctalEscapeSequence : StringTokenKind.Normal,
			str,
			{
				source : lexer.sourcePath,
				start : {
					line : startLine,
					column : startIndex - lexer.lineStarts [startLine],
					index : startIndex
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

System.breakPrototypeChain ( StringToken );