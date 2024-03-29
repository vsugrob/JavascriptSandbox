/// <reference path="../../System.ts" />
/// <reference path="../../Configuration.ts" />
/// <reference path="Token.ts" />
/// <reference path="NumericToken.ts" />
/// <reference path="StringToken.ts" />
/// <reference path="IdentifierToken.ts" />
/// <reference path="RegexToken.ts" />
/// <reference path="PunctuatorToken.ts" />
/// <reference path="CommentNode.ts" />
'use strict';

interface LineStartDictionary {
	[line : number] : number;
}

interface LexerOptions {
	/** The initial line number to use for source location information.
	  * Default: 1. */
	line? : number;
	/** A description of the input source; typically a filename, path, or URL.
	  * This string is not meaningful to the parsing process,
	  * but is produced as part of the source location information in the returned AST nodes.
	  * Default: null. */
	source? : string;
	/** When true, Lexer.comments will be filled with elements of type CommentNode.
	  * Default: false. */
	collectComments? : boolean;
	/** Allow keywords to contain unicode hex escapes?
	  * E.g. keyword 'for' can be written as '\u0066\u006f\u0072'.
	  * Default: true. */
	allowEscapeSequenceInKeyword? : boolean;
	/** Allow regex flags to contain unicode hex escapes?
	  * E.g. '/regex/gim' can be written as '/regex/\u0067\u0069\u006d'.
	  * Default: true. */
	allowEscapeSequenceInRegexFlags? : boolean;
}

interface CharDescriptionMap {
	[cc : number] : string;
}

/* TODO: recalc token rates, now on 3.2mils of source code contained in
 * 'tests/parser/test-scripts/cdnjs.zip'. I guess the best way to do this
 * is to modify 'tests/parser/parser.ts': enhance it with the logic from
 * 'tools/calc-token-rates.ts'. Or vice versa, maybe it's better to modify
 * 'calc-token-rates.ts' because calculation of token rates is tooling task,
 * not a test. */
class Lexer {
	public static DEBUG = undefined;
	public code : string;
	public index : number;
	public line : number;
	public lineStarts : LineStartDictionary;
	public lineStartIndex : number;
	public length : number;
	public token : Token;
	public comments : CommentNode [];
	public sourcePath : string;		// Source code path.
	public collectComments : boolean;
	public allowEscapeSequenceInKeyword : boolean;
	public allowEscapeSequenceInRegexFlags : boolean;

	// This regular expression obtained with tools/GenLexerRegex.
	private static whitespace = /[\u1680\u180e\u2000-\u200a\u202f\u205f\u3000]/;

	public get eofToken () {
		var column = this.index - this.lineStartIndex;
		
		if ( this.token && this.token.type === TokenType.EOF )
			return	this.token;
		else {
			var eof : Token = {
				type : TokenType.EOF,
				kind : -1,
				value : null,
				loc : {
					source : this.sourcePath,
					start : { line : this.line, column : column, index : this.index },
					end : { line : this.line, column : column, index : this.index },
				},
				prev : this.token,
				next : null
			};

			if ( this.token )
				this.token.next = eof;

			this.token = eof;

			return	eof;
		}
	}

	public get illegalCharToken () {
		var column = this.index - this.lineStartIndex,
			illegal : Token = {
				type : TokenType.ILLEGAL,
				kind : -1,
				value : this.code [this.index],
				loc : {
					source : this.sourcePath,
					start : { line : this.line, column : column, index : this.index },
					end : { line : this.line, column : column, index : this.index },
				},
				prev : this.token,
				next : null
			};

		if ( this.token )
			this.token.next = illegal;

		this.token = illegal;

		return	illegal;
	}

	public static builtin = System.builtin.freeze ( {
		Error : Error,
		NumberToString : Number.prototype.toString,
		RegExp : RegExp,
		String : String,
		SyntaxError : SyntaxError,
		charCodeAt : String.prototype.charCodeAt,
		create : Object.create,
		fromCharCode : String.fromCharCode,
		getOwnPropertyNames : Object.getOwnPropertyNames,
		hasOwnProperty : Object.prototype.hasOwnProperty,
		parseFloat : parseFloat,
		parseInt : parseInt,
		push : Array.prototype.push,
		replace : String.prototype.replace,
		substring : String.prototype.substring
	} );

	constructor () {}
	
	public init ( code : string, options? : LexerOptions ) {
		this.readOptions ( options );
		this.code = Lexer.builtin.String ( code );
		this.index = 0;
		this.lineStarts = <LineStartDictionary> Lexer.builtin.create ( null );
		this.lineStarts [this.line] =
			this.lineStartIndex = 0;
		this.length = this.code.length;
		this.token = null;
		this.comments = [];
	}

	private readOptions ( options : LexerOptions ) {
		// Set defaults.
		this.line = 1;
		this.sourcePath = null;
		this.collectComments = false;
		this.allowEscapeSequenceInKeyword = true;
		this.allowEscapeSequenceInRegexFlags = true;

		// Read custom values.
		if ( options ) {
			if ( 'line' in options ) this.line = options.line | 0;
			if ( options.source != null ) this.sourcePath = Parser.builtin.String ( options.source );
			if ( 'collectComments' in options ) this.collectComments = !!options.collectComments;
			if ( 'allowEscapeSequenceInKeyword' in options )
				this.allowEscapeSequenceInKeyword = !!options.allowEscapeSequenceInKeyword;
			if ( 'allowEscapeSequenceInRegexFlags' in options )
				this.allowEscapeSequenceInRegexFlags = !!options.allowEscapeSequenceInRegexFlags;
		}
	}

	public read () {
		if ( this.stepForward () )
			return	this.token;

		while ( this.index < this.length ) {
			this.skipWhitespace ();

			if ( this.index >= this.length )
				return	this.eofToken;

			var cc = Lexer.builtin.charCodeAt.call ( this.code, this.index );

			if ( cc < 0x80 ) {	// Is ASCII character.
				// Expect any kind of token.
				if ( cc >= 0x61 /*a*/ && cc <= 0x7a /*z*/ ) {	// 35.57% probability
					return	this.token = IdentifierToken.read ( this );
				} else if ( cc === 0x2e /*.*/ ) {	// 12.63% probability
					var ccNext = Lexer.builtin.charCodeAt.call ( this.code, this.index + 1 );

					if ( ccNext >= 0x30 /*0*/ && ccNext <= 0x39 /*9*/ )
						return	this.token = NumericToken.readFractionLiteral ( this, this.index );
					else
						return	this.token = PunctuatorToken.fromValue ( this, '.' );
				} else if ( cc === 0x3b /*;*/ )	{	// 7.22% probability
					return	this.token = PunctuatorToken.fromValue ( this, this.code [this.index] );
				} else if ( cc >= 0x41 /*A*/ && cc <= 0x5a /*Z*/ ) {	// 5.94% probability
					return	this.token = IdentifierToken.read ( this );
				} else if ( cc === 0x28 /*(*/ || cc === 0x29 /*)*/ ) {	// 5.72% and 5.72% probability
					return	this.token = PunctuatorToken.fromValue ( this, this.code [this.index] );
				} else if ( cc === 0x27 /*'*/ || cc === 0x22 /*"*/ ) {	// 2.25% probability
					return	this.token = StringToken.read ( this );
				} else if ( cc >= 0x30 /*0*/ && cc <= 0x39 /*9*/ ) {	// 0.69% probability
					return	this.token = NumericToken.read ( this );
				} else if ( cc === 0x24 /*$*/ || cc === 0x5f /*_*/ ||
							cc === 0x5c /*\*/ )
				{
					return	this.token = IdentifierToken.read ( this );
				} else if ( cc === 0x2f /*/*/ ) {
					var token = this.readAmbiguousSlash ();

					if ( token !== null )
						return	this.token = token;
					// else: it was comment, continue reading.
				} else
					return	this.token = PunctuatorToken.read ( this );
			} else {
				// Expect Identifier or illegal character.
				if ( cc >= 0xaa && IdentifierToken.idStart.test ( this.code [this.index] ) )
					return	this.token = IdentifierToken.read ( this );
				else
					Lexer.surprise ( this.illegalCharToken );
			}
		}

		return	this.eofToken;
	}

	private skipWhitespace () {
		// For more info read Docs/Ecma-262.pdf, "7.2 White Space" and "7.3 Line Terminators".
		while ( this.index < this.length ) {
			var cc = Lexer.builtin.charCodeAt.call ( this.code, this.index );

			if ( cc === 0x20 /*Space <SP>*/ ||
				 cc === 0x09 /*Tab <TAB>*/
			) {
				/* Space and horizontal tab are the most common whitespace
				 * characters, that's why we check them first. */
			} else if ( cc === 0xa /*<LF>*/ ||
						cc === 0x2028 /*LINE SEPARATOR <LS>*/ ||
						cc === 0x2029 /*PARAGRAPH SEPARATOR <PS>*/ )
			{
				this.newline ( this.index + 1 );
			} else if ( cc === 0xd /*<CR>*/ ) {
				var ccNext = Lexer.builtin.charCodeAt.call ( this.code, this.index + 1 );

				if ( ccNext === 0xa /*<LF>*/ )
					this.index++;

				this.newline ( this.index + 1 );
			} else if ( cc !== 0x0b &&		// Vertical Tab <VT>, \v
						cc !== 0x0c &&		// Form Feed <FF>, \f
						cc !== 0xa0 &&		// No-break space <NBSP>
						cc !== 0xfeff &&	// Byte Order Mark <BOM>
						!Lexer.whitespace.test ( this.code [this.index] )
			) {
				break;
			}

			this.index++;
		}
	}

	private readAmbiguousSlash () : Token {
		var ccNext = Lexer.builtin.charCodeAt.call ( this.code, this.index + 1 );

		if ( ccNext === 0x2f /*/*/ ) {
			CommentNode.readSingleLineComment ( this );

			return	null;	// null means: "Continue reading next token."
		} else if ( ccNext === 0x2a /***/ ) {
			CommentNode.readMultiLineComment ( this );

			return	null;	// null means: "Continue reading next token."
		} else {
			var token = this.token,	// Preceding token
				/* Slash is regex delimiter when true and
				 * it's division (or compound division) when false. */
				isRegex : boolean;

			/* Note Docs/Ecma-262.pdf, "7 Lexical Conventions":
			 * There are no syntactic grammar contexts where both a leading division
			 * or division-assignment, and a leading RegularExpressionLiteral are permitted.
			 * This is not affected by semicolon insertion. */
			if ( token === null ) {
				/* Backtrack state is: '<start of file> /'.
				 * Only regex can be at this place. */
				isRegex = true;
			} else if ( token.type === TokenType.Identifier ) {
				/* Backtrack state is: 'id /'.
				 * See section "2) Reserved word preceding '/'" in
				 * Docs/division-or-regex-preceding-tokens.txt for rationale. */
				if ( token.kind === IdentifierKind.Name ||
					 token.kind === IdentifierKind.BooleanLiteral ||
					 token.kind === IdentifierKind.NullLiteral )
				{
					// Backtrack state is: 'valueId /'.
					isRegex = false;
				} else /*if ( token.kind === IdentifierKind.FutureReservedWord ||
							  token.kind === IdentifierKind.Keyword ||
							  token.kind === IdentifierKind.StrictFutureReservedWord )*/
				{
					var name = <string> token.value;
					isRegex = Lexer.builtin.hasOwnProperty.call ( RegexToken.regexPrecedingWords, name );
				}
			} else if ( token.type === TokenType.Punctuator ) {
				/* See section "1) Punctuator preceding '/'" in
				 * Docs/division-or-regex-preceding-tokens.txt for rationale. */
				if ( token.kind === Punctuator.Dot ) {
					/* Backtrack state is: './'.
					 * Eventually this will end up in an error at parser stage. */
					isRegex = false;
				} else if ( token.kind === Punctuator.RBracket ) {
					// Backtrack state is: ']/'.
					isRegex = false;
				} else if ( token.kind === Punctuator.RCurly ) {
					/* Backtrack state is: '}/'.
					 * Ambiguity: '}' is last token of FunctionExpression and ObjectExpression
					 * that can be followed only by division or compound division.
					 * But it can also be a last token of FunctionDeclaration, BlockStatement or
					 * SwitchStatement, and only regex is allowed to follow it. */
					
					return	PunctuatorToken.createAmbiguousSlash ( this );
				} else if ( token.kind === Punctuator.RParen ) {
					/* Backtrack state is: ')/'.
					 * Ambiguity: ')' can be ending token of CallExpression, NewExpression or
					 * grouping operator, all of which can be followed by division or compound division,
					 * but not regex.
					 * On the other hand ')' can end ForInStatement, ForStatement, DoWhileStatement,
					 * IfStatement, WhileStatement, WithStatement, in which case only regex is allowed. */

					return	PunctuatorToken.createAmbiguousSlash ( this );
				} else if ( token.kind === Punctuator.Increase ||
							token.kind === Punctuator.Decrease )
				{
					return	PunctuatorToken.createAmbiguousSlash ( this );
				} else {
					/* See section "1) Punctuator preceding '/'" in
					 * Docs/division-or-regex-preceding-tokens.txt for explanation. */
					isRegex = true;
				}
			} else /*if ( token.type === TokenType.NumericLiteral ||
						  token.type === TokenType.RegularExpression ||
						  token.type === TokenType.StringLiteral )*/
			{
				// Backtrack state is: '<numeric/string literal or regex>/'.
				isRegex = false;
			}

			if ( isRegex )
				return	RegexToken.read ( this );
			else {
				if ( ccNext === 0x3d /*=*/ )
					return	PunctuatorToken.fromValue ( this, '/=' );
				else
					return	PunctuatorToken.fromValue ( this, '/' );
			}
		}
	}

	public resolveAmbiguousSlash ( isDivision : boolean ) : Token {
		this.stepBackward ();
		this.skipWhitespace ();

		if ( Lexer.DEBUG ) {
			System.assert (
				this.code [this.index] === '/' &&
				this.code [this.index + 1] !== '/' &&
				this.code [this.index + 1] !== '*'
			);
		}

		if ( isDivision ) {
			/* At this point this.index points to slash character '/'.
			 * In addition we're sure that next character is neither a '/' or '*'
			 * because Lexer.readAmbiguousSlash () already checked for them. */
			var ccNext = Lexer.builtin.charCodeAt.call ( this.code, this.index + 1 );

			if ( ccNext === 0x3d /*=*/ )
				return	this.token = PunctuatorToken.fromValue ( this, '/=' );
			else
				return	this.token = PunctuatorToken.fromValue ( this, '/' );
		} else /*if ( !isDivision )*/
			return	this.token = RegexToken.read ( this );
	}

	public stepForward () {
		var token = this.token;

		if ( token && token.next ) {
			this.token = token.next;
			this.setPosition ( this.token.loc.end );

			return	this.token;
		} else
			return	null;
	}

	public stepBackward () {
		var token = this.token;

		if ( token && token.prev ) {
			this.token = token.prev;
			this.setPosition ( this.token.loc.end );

			return	this.token;
		} else
			return	null;
	}

	public jump ( targetToken : Token ) {
		this.token = targetToken;
		this.setPosition ( targetToken.loc.end );
	}

	private setPosition ( position : SourcePosition ) {
		this.index = position.index;
		this.line = position.line;
		this.lineStartIndex = this.lineStarts [this.line];
	}

	public newline ( newLineStartIndex : number ) {
		this.line++;
		this.lineStarts [this.line] =
			this.lineStartIndex = newLineStartIndex;
	}

	public static surprise ( token : Token, where? : string, expectation? : string ) {
		var message = 'Unexpected ';

		// Try to deduce what's the subject of surprise.
		if ( token.type === TokenType.EOF )
			message += 'end of input';
		else if ( token.type === TokenType.ILLEGAL )
			message += Lexer.describeCharacter ( token.value ) + ' character';
		else if ( token.type === TokenType.Identifier ) {
			if ( token.kind === IdentifierKind.BooleanLiteral )
				message += 'boolean literal';
			else if ( token.kind === IdentifierKind.NullLiteral )
				message += 'literal';
			else if ( token.kind === IdentifierKind.Keyword )
				message += 'keyword';
			else if ( token.kind === IdentifierKind.FutureReservedWord )
				message += 'reserved word';
			else if ( token.kind === IdentifierKind.StrictFutureReservedWord )
				message += 'strict mode reserved word';
			else /*if ( token.kind === IdentifierKind.Name )*/
				message += 'identifier';

			message += ' "' + token.value + '"';
		} else if ( token.type === TokenType.Punctuator )
			message += 'punctuator `' + token.value + '`';
		else if ( token.type === TokenType.NumericLiteral )
			message += 'number ' + token.value;
		else if ( token.type === TokenType.StringLiteral ) {
			var stringValue = Lexer.builtin.replace.call ( token.value, /"/g, '\\"' );
			message += 'string "' + stringValue + '"';
		} else /*if ( token.type === TokenType.RegularExpression )*/
			message += 'regular expression ' + Lexer.builtin.String ( token.value );

		if ( where )
			message += ' in ' + where;

		if ( expectation )
			message += '. Expected: ' + expectation;

		Lexer.syntaxError ( token, message );
	}

	public static syntaxError ( token : Token, message : string ) {
		var pos = token.loc.start,
			exc = <any> new Lexer.builtin.SyntaxError ( message );
		
		exc.description = message;	// IE
		exc.lineNumber = pos.line;
		exc.column = pos.column;
		exc.index = pos.index;
		exc.fileName = token.loc.source;
		// TODO: mark strict mode errors with exc.isStrictError = true;

		throw exc;
	}

	private static charDescriptionMap = <CharDescriptionMap> Object.freeze ( Object.create ( null, {
		0x0a : { value : 'line feed' },
		0x0d : { value : 'carriage return' },
		0x2028 : { value : 'line separator' },
		0x2029 : { value : 'paragraph separator' },
		0x20 : { value : 'space' },
		0x09 : { value : 'tab' },
		0x0b : { value : 'vertical tab' },
		0x0c : { value : 'form feed' },
		0xa0 : { value : 'no-break space' },
		0xfeff : { value : 'byte order mark' },
	} ) );

	private static describeCharacter ( ch : string ) {
		var desc : string,
			cc = Lexer.builtin.charCodeAt.call ( ch, 0 )

		if ( cc >= 0x30 /*0*/ && cc <= 0x39 /*9*/ )
			desc = 'digit "' + ch + '"';
		else if ( cc >= 0x21 /*!*/ && cc <= 0x7e /*~*/ )
			desc = ch;
		else {
			desc = Lexer.charDescriptionMap [cc];

			if ( desc === undefined ) {
				var hexStr = Lexer.builtin.NumberToString.call ( cc, 16 );
			
				while ( hexStr.length < 4 ) {
					hexStr = '0' + hexStr;
				}

				desc = '\\u' + hexStr;
			}
		}

		return	desc;
	}

	public throwEofOrIllegal ( where? : string, expectation? : string ) {
		Lexer.surprise (
			this.index >= this.length ? this.eofToken : this.illegalCharToken,
			where,
			expectation
		);
	}
}

System.breakPrototypeChain ( Lexer );
Configuration.freezeSetting ( Lexer, 'DEBUG', Configuration.DEBUG );