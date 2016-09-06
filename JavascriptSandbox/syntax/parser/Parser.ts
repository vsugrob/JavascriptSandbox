/// <reference path="../lexer/Lexer.ts" />
/// <reference path="../mozilla/MozillaParserOptions.ts" />
/// <reference path="StatementParser.ts" />
/// <reference path="DefaultAstBuilder.ts" />
'use strict';

interface LabelDictionaryEntry {
	// Whether label encloses iteration statement.
	enclosesIteration : boolean;
	// Label depth in context of statement tree.
	depth : number;
}

interface LabelDictionary {
	/** @param safeName is label name prepended with single space character
	  * which prevents it from collision with '__proto__'. */
	[safeName : string] : LabelDictionaryEntry;
}

/** This data is specific to function lexical scope.
  * It is necessary when we meet 'use strict' directive
  * in the body of a function which was defined in
  * non-strict context. In such situations we must
  * revalidate function name and parameters against
  * strict mode limitations.
  */
interface FunctionScopeData {
	funcIdToken : IdentifierToken;
	paramTokens : IdentifierToken [];
}

// TODO: rename to lexical scope?
interface ParserScope {
	isStrict : boolean;
	inFunction : boolean;
	inIteration : boolean;
	inSwitch : boolean;
	labels : LabelDictionary;
	funcData : FunctionScopeData;
	parent : ParserScope;
	/* Depth of the statement corresponding to
	 * this scope in context of the statement tree. */
	depth : number;
}

interface ParserOptions extends MozillaParserOptions {
	/** When isStrict is true, the parser treats input according to
	  * "strict mode" rules listed in Docs/Ecma-262.pdf,
	  * "Annex C (informative) The Strict Mode of ECMAScript" even when
	  * source code does not contain Strict Mode Directive 'use strict'.
	  * Default: false. */
	isStrict? : boolean;
	/** Whether to parse let variable declarations.
	  * Default: true.
	  * Spec: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let */
	parseLet? : boolean;
	/** Whether to parse const variable declarations.
	  * Default: true.
	  * Spec: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/const */
	parseConst? : boolean;
	/** When true, ParseResult.comments will be filled with elements of type CommentNode.
	  * Default: false. */
	collectComments? : boolean;
	/** Allow keywords to contain unicode hex escapes?
	  * E.g. keyword 'for' can be written '\u0066\u006f\u0072'.
	  * Default: true. */
	allowEscapeSequenceInKeyword? : boolean;
	/** Allow regex flags to contain unicode hex escapes?
	  * E.g. '/regex/gim' can be written as '/regex/\u0067\u0069\u006d'.
	  * Default: true. */
	allowEscapeSequenceInRegexFlags? : boolean;
}

interface ParseResult {
	/** Abstract Syntax Tree constructed during the parsing of the source code.
	  * Format of its nodes depends on value of options.builder. */
	ast : any;
	/** Comments that were collected during the lexical analyze of the code.
	  * Value of this field depends on options passed as argument of parse method,
	  * it is an empty array when ParserOptions.collectComments is not true. */
	comments : CommentNode [];
}

class Parser {
	public static DEBUG = undefined;
	public lexer : Lexer;
	public scope : ParserScope;
	public startLineIndex : number;		// Index of the first line of source code.
	public provideLoc : boolean;		// Whether we should add location info to each produced AST node.
	public sourcePath : string;			// Source code path.
	public builder : AstBuilder;		// AstNode factory.
	public isStrict : boolean;			// Whether source code should be parsed according to 'strict mode' rules.
	public parseLet : boolean;			// Parse let variable declarations.
	public parseConst : boolean;		// Parse const variable declarations.
	public collectComments : boolean;
	public allowEscapeSequenceInKeyword : boolean;
	public allowEscapeSequenceInRegexFlags : boolean;
	/** This indicates that Parser.parse () method is currently running.
	  * Note that parser can invoke custom ast node builder callback
	  * which in turn can possibly call Parser.parse () on the same parser instance,
	  * corrupting thus its internal state. This flag protects parser from
	  * such recursive calls. */
	private isParsing = false;

	/* TODO: use Lexer.builtin.* methods when possible.
	 * Clean methods that can be pulled from Lexer.builtin. */
	public static builtin = System.builtin.freeze ( {
		Error : Error,
		String : String,
		create : Object.create,
		hasOwnProperty : Object.prototype.hasOwnProperty,
		pop : Array.prototype.pop,
		push : Array.prototype.push,
	} );

	private static builderMethodsNames = [
		'program', 'emptyStatement', 'blockStatement', 'expressionStatement',
		'labeledStatement', 'ifStatement', 'switchStatement', 'whileStatement',
		'doWhileStatement', 'forStatement', 'forInStatement', 'breakStatement',
		'continueStatement', 'withStatement', 'returnStatement', 'tryStatement',
		'throwStatement', 'debuggerStatement', 'letStatement', 'functionDeclaration',
		'variableDeclaration', 'variableDeclarator', 'sequenceExpression',
		'conditionalExpression', 'unaryExpression', 'binaryExpression',
		'assignmentExpression', 'logicalExpression', 'updateExpression',
		'newExpression', 'callExpression', 'memberExpression', 'functionExpression',
		'arrayExpression', 'objectExpression', 'thisExpression', 'comprehensionExpression',
		'generatorExpression', 'yieldExpression', 'letExpression', 'arrayPattern',
		'objectPattern', 'propertyPattern', 'switchCase', 'catchClause', 'comprehensionBlock',
		'identifier', 'literal', 'property'
	];

	constructor () {
		this.lexer = new Lexer ();
	}

	/* TODO: test multiple calls of parse () method.
	 * Ensure that every necessary field is properly reinitialized. */
	public parse ( code : string, options? : ParserOptions ) {
		// Check whether call to this method is recurrent.
		if ( this.isParsing ) {
			throw new Parser.builtin.Error (
				'Recurrent calls of this method are forbidden.'
			);
		}

		this.readOptions ( options );
		this.lexer.init ( code, {
			line : this.startLineIndex,
			source : this.sourcePath,
			collectComments : this.collectComments,
			allowEscapeSequenceInKeyword : this.allowEscapeSequenceInKeyword,
			allowEscapeSequenceInRegexFlags : this.allowEscapeSequenceInRegexFlags
		} );

		this.scope = null;
		var programScope = this.enterLexicalScope ();
		programScope.isStrict = this.isStrict;
		programScope.inFunction = false;
		programScope.inIteration = false;
		programScope.inSwitch = false;
		programScope.labels = Parser.builtin.create ( null );
		programScope.funcData = null;

		this.isParsing = true;

		var program : any;

		try {
			this.lexer.read ();	// Pump first token.
			program = this.parseProgram ();
		} finally {
			this.exitLexicalScope ();
			this.isParsing = false;
		}

		return	<ParseResult> {
			ast : program,
			comments : this.lexer.comments
		};
	}

	private readOptions ( options : ParserOptions ) {
		// Set defaults.
		this.startLineIndex = 1;
		this.provideLoc = true;
		this.sourcePath = null;
		this.builder = null;
		this.isStrict = false;
		this.parseLet = true;
		this.parseConst = true;
		this.collectComments = false;
		this.allowEscapeSequenceInKeyword = true;
		this.allowEscapeSequenceInRegexFlags = true;
		
		// Read custom values.
		if ( options ) {
			if ( 'line' in options ) this.startLineIndex = options.line | 0;
			if ( 'loc' in options ) this.provideLoc = !!options.loc;
			if ( options.source != null ) this.sourcePath = Parser.builtin.String ( options.source );
			if ( options.builder != null && typeof options.builder === 'object' ) this.builder = options.builder;
			if ( 'isStrict' in options ) this.isStrict = !!options.isStrict;
			if ( 'allowLet' in options ) this.parseLet = !!options.parseLet;
			if ( 'allowConst' in options ) this.parseConst = !!options.parseConst;
			if ( 'collectComments' in options ) this.collectComments = !!options.collectComments;
			if ( 'allowEscapeSequenceInKeyword' in options )
				this.allowEscapeSequenceInKeyword = !!options.allowEscapeSequenceInKeyword;
			if ( 'allowEscapeSequenceInRegexFlags' in options )
				this.allowEscapeSequenceInRegexFlags = !!options.allowEscapeSequenceInRegexFlags;
		}

		this.setupBuilder ();
	}

	private setupBuilder () {
		var defaultBuilder = new DefaultAstBuilder ();

		if ( this.builder === null )
			this.builder = defaultBuilder;
		else {
			var customBuilder = this.builder;
			this.builder = Parser.builtin.create ( null );

			for ( var i = 0 ; i < Parser.builderMethodsNames.length ; i++ ) {
				var methodName = Parser.builderMethodsNames [i];

				if ( typeof customBuilder [methodName] === 'function' ) {
					this.builder [methodName] =
						( <Function> customBuilder [methodName] ).bind ( customBuilder );
				} else {
					/* Some of the factory methods are reserved for future versions
					 * of ecma 262 specification and therefore not implemented. */
					if ( !( methodName in defaultBuilder ) )
						continue;
					
					this.builder [methodName] = defaultBuilder [methodName];
				}
			}
		}
	}

	public enterLexicalScope () {
		var childScope = <ParserScope> Parser.builtin.create ( this.scope );
		childScope.parent = this.scope;
		childScope.depth = StatementParser.depth;
		this.scope = childScope;

		return	this.scope;
	}

	public exitLexicalScope () {
		if ( Parser.DEBUG )
			System.assert ( this.scope !== null );

		this.scope = this.scope.parent;
	}

	private parseProgram () {
		var locStart = this.lexer.token.loc.start,
			statements = StatementParser.parseTopLevelStatements ( this );

		return	this.builder.program ( statements, this.createLoc ( locStart ) );
	}

	public locByToken ( token : Token ) {
		var start = token.loc.start,
			end = token.loc.end;

		if ( this.provideLoc ) {
			return	{
				source : this.sourcePath,
				start : {
					line : start.line,
					column : start.column,
					index : start.index
				},
				end : {
					line : end.line,
					column : end.column,
					index : end.index
				}
			}
		} else
			return	null;
	}

	public createLoc ( start : SourcePosition ) {
		if ( this.provideLoc ) {
			var token = this.lexer.token;

			if ( token.prev ) {
				var end = token.prev.loc.end;

				return	{
					source : this.sourcePath,
					start : {
						line : start.line,
						column : start.column,
						index : start.index
					},
					end : {
						line : end.line,
						column : end.column,
						index : end.index
					}
				}
			} else {
				// There is only one token - EOF.
				return	{
					source : this.sourcePath,
					start : {
						line : start.line,
						column : start.column,
						index : start.index
					},
					end : {
						line : start.line,
						column : start.column,
						index : start.index
					}
				}
			}
		} else
			return	null;
	}

	public validateOctals ( token : Token ) {
		if ( token.type === TokenType.NumericLiteral &&
			this.scope.isStrict && token.kind === NumericTokenKind.Octal )
		{
			/* Docs/Ecma-262.pdf, "7.8.3 Numeric Literals":
			 * A conforming implementation, when processing strict mode code (see 10.1.1),
			 * must not extend the syntax of NumericLiteral to include OctalIntegerLiteral
			 * as described in B.1.1. */
			Lexer.syntaxError ( token, 'Octal literals are not allowed in strict mode' );
		} else if ( token.type === TokenType.StringLiteral &&
			this.scope.isStrict && token.kind === StringTokenKind.WithOctalEscapeSequence )
		{
			/* Docs/Ecma-262.pdf, "7.8.4 String Literals":
			 * A conforming implementation, when processing strict mode code (see 10.1.1),
			 * may not extend the syntax of EscapeSequence to include OctalEscapeSequence
			 * as described in B.1.2. */
			Lexer.syntaxError ( token, 'Octal escape sequences are not allowed in strict mode' );
		}
	}
}

System.breakPrototypeChain ( Parser );
Configuration.freezeSetting ( Parser, 'DEBUG', Configuration.DEBUG );