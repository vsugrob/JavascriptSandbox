/// <reference path="Lexer.ts" />
/// <reference path="Punctuator.ts" />
'use strict';

interface PunctuatorKindMap {
	[str : string] : Punctuator;
}

class PunctuatorToken implements Token {
	public type : TokenType;

	constructor (
		public kind : number,
		public value : any,
		public loc : SourceLocation,
		public prev : Token = null,
		public next : Token = null
	) {
		this.type = TokenType.Punctuator;

		if ( this.prev !== null )
			this.prev.next = this;
	}

	public static read ( lexer : Lexer ) {
		/* Note: punctuators '.', ';', '(' and ')' are handled in the Lexer.read () method.
		 * Punctuators '/' and '/=' is concern of Lexer.readAmbiguousSlash () method.
		 * Here we match input characters against the rest punctuators.
		 * Unlike other *Token.read () methods, error is thrown when match wasn't found. */

		var cc = Lexer.builtin.charCodeAt.call ( lexer.code, lexer.index ),
			end = lexer.index + 1,
			/* First few chars represents binary operator which may be followed
			 * by '=' sign, e.g. '+' (+=), '*' (*=), '>>' (>>=), etc. */
			startsWithBinOp = false;

		if ( cc === 0x3d /*=*/ ) {	// 6.24% probability.
			cc = Lexer.builtin.charCodeAt.call ( lexer.code, end );

			if ( cc === 0x3d /*=*/ ) {
				cc = Lexer.builtin.charCodeAt.call ( lexer.code, end + 1 );

				if ( cc === 0x3d /*=*/ )
					return	PunctuatorToken.fromValue ( lexer, '===' );
				else
					return	PunctuatorToken.fromValue ( lexer, '==' );
			} else
				return	PunctuatorToken.fromValue ( lexer, '=' );
		} else if ( cc === 0x2c /*,*/ ||	//	3.67% probability.
					cc === 0x7b /*{*/ ||	//	3.61% probability.
					cc === 0x7d /*}*/ ||	//	3.61% probability.
					cc === 0x5b /*[*/ ||	//	1.89% probability.
					cc === 0x5d /*]*/		//	1.89% probability.
		) {
			return	PunctuatorToken.fromValue ( lexer, lexer.code [lexer.index] );
		} else if ( cc === 0x2b /*+*/ ) {	// 1.49% probability.
			cc = Lexer.builtin.charCodeAt.call ( lexer.code, end );

			if ( cc === 0x2b /*+*/ )
				return	PunctuatorToken.fromValue ( lexer, '++' );
			else
				startsWithBinOp = true;
		} else if ( cc === 0x3a /*:*/ ) {	// 0.81% probability.
			return	PunctuatorToken.fromValue ( lexer, ':' );
		} else if ( cc === 0x21 /*!*/ ) {	// 0.34% probability.
			cc = Lexer.builtin.charCodeAt.call ( lexer.code, end );

			if ( cc === 0x3d /*=*/ ) {
				cc = Lexer.builtin.charCodeAt.call ( lexer.code, end + 1 );

				if ( cc === 0x3d /*=*/ )
					return	PunctuatorToken.fromValue ( lexer, '!==' );
				else
					return	PunctuatorToken.fromValue ( lexer, '!=' );
			} else
				return	PunctuatorToken.fromValue ( lexer, '!' );
		} else if ( cc === 0x7c /*|*/ ) {	// 0.32% probability.
			cc = Lexer.builtin.charCodeAt.call ( lexer.code, end );

			if ( cc === 0x7c /*|*/ )
				return	PunctuatorToken.fromValue ( lexer, '||' );
			else
				startsWithBinOp = true;
		} else if ( cc === 0x3c /*<*/ ) {	// 0.13% probability.
			cc = Lexer.builtin.charCodeAt.call ( lexer.code, end );

			if ( cc === 0x3c /*<*/ )	// We've got '<<'.
				end++;
			
			startsWithBinOp = true;
		} else if ( cc === 0x26 /*&*/ ) {	// 0.08% probability.
			cc = Lexer.builtin.charCodeAt.call ( lexer.code, end );

			if ( cc === 0x26 /*&*/ )
				return	PunctuatorToken.fromValue ( lexer, '&&' );
			else
				startsWithBinOp = true;
		} else if ( cc === 0x2d /*-*/ ) {	// 0.06% probability.
			cc = Lexer.builtin.charCodeAt.call ( lexer.code, end );

			if ( cc === 0x2d /*-*/ )
				return	PunctuatorToken.fromValue ( lexer, '--' );
			else
				startsWithBinOp = true;
		} else if ( cc === 0x3e /*>*/ ) {	// 0.05% probability.
			cc = Lexer.builtin.charCodeAt.call ( lexer.code, end );

			if ( cc === 0x3e /*>*/ ) {	// We've got at least '>>'.
				cc = Lexer.builtin.charCodeAt.call ( lexer.code, ++end );

				if ( cc === 0x3e /*>*/ )	// We've got '>>>'.
					end++;
			}
			
			startsWithBinOp = true;
		} else if ( cc === 0x3f /*?*/ ) {	// 0.04% probability.
			return	PunctuatorToken.fromValue ( lexer, '?' );
		} else if ( cc === 0x25 /*%*/ || cc === 0x2a /***/ || cc === 0x5e /*^*/ ) {
			startsWithBinOp = true;
		} else if ( cc === 0x7e /*~*/ )
			return	PunctuatorToken.fromValue ( lexer, '~' );

		if ( startsWithBinOp ) {
			cc = Lexer.builtin.charCodeAt.call ( lexer.code, end );

			if ( cc === 0x3d /*=*/ )
				end++;

			var punctStr = Lexer.builtin.substring.call ( lexer.code, lexer.index, end );

			return	PunctuatorToken.fromValue ( lexer, punctStr );
		} else
			Lexer.surprise ( lexer.illegalCharToken );
	}

	public static fromValue ( lexer : Lexer, value : string ) {
		var start = lexer.index;
		lexer.index += value.length;
		
		return	new PunctuatorToken (
			PunctuatorToken.punctuatorKindMap [value],
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

	public static createAmbiguousSlash ( lexer : Lexer ) {
		return	new PunctuatorToken (
			Punctuator.AmbiguousSlash,
			'/',
			{
				source : lexer.sourcePath,
				start : {
					line : lexer.line,
					column : lexer.index - lexer.lineStartIndex,
					index : lexer.index
				},
				end : {
					line : lexer.line,
					// Increase index by the length of '/' string.
					column : ( ++lexer.index ) - lexer.lineStartIndex,
					index : lexer.index
				},
			},
			lexer.token
		);
	}

	public static match ( token : Token, kind : Punctuator ) {
		return	token.type === TokenType.Punctuator && token.kind === kind;
	}

	public static expect ( lexer : Lexer, kind : Punctuator, readNext = true ) {
		if ( !PunctuatorToken.match ( lexer.token, kind ) ) {
			Lexer.surprise (
				lexer.token,
				null,	// where
				'punctuator `' + PunctuatorToken.kindToString ( kind ) + '`'
			);
		}

		if ( readNext )
			lexer.read ();
	}

	private static kindToString ( kind : Punctuator ) {
		var map = PunctuatorToken.punctuatorKindMap;

		for ( var puncStr in map ) {
			var puncKind = map [puncStr];

			if ( puncKind === kind )
				return	puncStr;
		}
		
		throw new Lexer.builtin.Error ( 'Internal error' );
	}

	/* This was derived from enum Punctuator code by using 'Search and Replace':
	 * Search: (\w+),\s+//\s*(.*)
	 * Replace: '\2' : Punctuator.\1,
	 */
	public static punctuatorKindMap = <PunctuatorKindMap> System.toFrozenMap ( {
		'{' : Punctuator.LCurly,
		'}' : Punctuator.RCurly,
		'(' : Punctuator.LParen,
		')' : Punctuator.RParen,
		'[' : Punctuator.LBracket,
		']' : Punctuator.RBracket,
		'.' : Punctuator.Dot,
		';' : Punctuator.Semicolon,
		',' : Punctuator.Comma,
		'<' : Punctuator.Lt,
		'>' : Punctuator.Gt,
		'<=' : Punctuator.LtOrEq,
		'>=' : Punctuator.GtOrEq,
		'==' : Punctuator.Eq,
		'!=' : Punctuator.NotEq,
		'===' : Punctuator.StrictEq,
		'!==' : Punctuator.StrictNotEq,
		'+' : Punctuator.Plus,
		'-' : Punctuator.Minus,
		'*' : Punctuator.Multiply,
		'%' : Punctuator.Modulo,
		'++' : Punctuator.Increase,
		'--' : Punctuator.Decrease,
		'<<' : Punctuator.LShift,
		'>>' : Punctuator.RShift,
		'>>>' : Punctuator.URShift,
		'&' : Punctuator.BitAnd,
		'|' : Punctuator.BitOr,
		'^' : Punctuator.BitXor,
		'!' : Punctuator.Not,
		'~' : Punctuator.BitNot,
		'&&' : Punctuator.And,
		'||' : Punctuator.Or,
		'?' : Punctuator.Question,
		':' : Punctuator.Colon,
		'=' : Punctuator.Assign,
		'+=' : Punctuator.PlusAssign,
		'-=' : Punctuator.MinusAssign,
		'*=' : Punctuator.MultiplyAssign,
		'%=' : Punctuator.ModuloAssign,
		'<<=' : Punctuator.LShiftAssign,
		'>>=' : Punctuator.RShiftAssign,
		'>>>=' : Punctuator.URShiftAssign,
		'&=' : Punctuator.BitAndAssign,
		'|=' : Punctuator.BitOrAssign,
		'^=' : Punctuator.BitXorAssign,
		'/' : Punctuator.Divide,
		'/=' : Punctuator.DivideAssign,
	} );
}

System.breakPrototypeChain ( PunctuatorToken );