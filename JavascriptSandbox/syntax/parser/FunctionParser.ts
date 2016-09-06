/// <reference path="Parser.ts" />
'use strict';

interface ParamNameHashSet {
	/** @param safeName is param name prepended with single space character
	  * which prevents it from collision with '__proto__'. */
	[safeName : string] : boolean;
}

class FunctionParser {
	public static parseFunction ( parser : Parser, isExpression : boolean ) {
		if ( Parser.DEBUG )
			System.assert ( IdentifierToken.matchKeyword ( parser.lexer.token, 'function' ) );

		var scope = parser.scope;

		// Check that function definition is at valid context.
		if ( !isExpression && scope.isStrict &&
			!( 
			   ( scope.parent === null &&	// At the top level.
			     StatementParser.depth === 1 ) ||
			   ( scope.inFunction &&		// Immediately within function.
			     Parser.builtin.hasOwnProperty.call ( scope, 'inFunction' ) &&
			     StatementParser.depth === scope.depth + 1 )
			 )
		) {
			Lexer.syntaxError (
				parser.lexer.token,
				'In strict mode code, functions can only be declared at top level or immediately within another function.'
			);
		}

		var lexer = parser.lexer,
			locStart = lexer.token.loc.start,
			funcIdToken = lexer.read (),
			builder = parser.builder,
			idExpr = null;
		
		if ( PunctuatorToken.match ( funcIdToken, Punctuator.LParen ) ) {
			if ( !isExpression ) {
				Lexer.surprise ( funcIdToken,
					'function declaration',
					'identifier serving as function name'
				);
			}

			funcIdToken = null;
		} else if ( funcIdToken.type === TokenType.Identifier ) {
			IdentifierToken.ensureNonKeyword ( parser, funcIdToken, 'function name', parser.scope.isStrict );
			idExpr = builder.identifier ( funcIdToken.value, parser.locByToken ( funcIdToken ) );
			lexer.read ();
			PunctuatorToken.expect ( lexer, Punctuator.LParen, false );
		} else {
			Lexer.surprise (
				funcIdToken,
				'function ' + ( isExpression ? 'declaration' : 'expression' ),
				isExpression ? 'identifier or parameter list' : 'identifier'
			);
		}

		return	FunctionParser.parserHeadlessFunction ( parser, idExpr, funcIdToken, isExpression, locStart );
	}

	// Parse code like '( arg1, ..., argN ) { <function body> }'.
	public static parserHeadlessFunction ( parser : Parser,
		idExpr : any, funcIdToken : any,
		isExpression : boolean, locStart? : SourcePosition )
	{
		if ( Parser.DEBUG )
			System.assert ( PunctuatorToken.match ( parser.lexer.token, Punctuator.LParen ) );

		var lexer = parser.lexer;

		if ( !locStart )
			locStart = lexer.token.loc.start;

		var token = lexer.read (),
			builder = parser.builder,
			isStrictScope = parser.scope.isStrict,
			paramTokens : IdentifierToken [] = [],
			paramNameHashSet : ParamNameHashSet = isStrictScope ? Parser.builtin.create ( null ) : null,
			params : any [] = [];

		// Parse function parameters.
		if ( PunctuatorToken.match ( token, Punctuator.RParen ) ) {
			// Empty parentheses '()'.
			lexer.read ();
		} else {
			lexer.stepBackward ();

			do {
				token = lexer.read ();

				if ( token.type !== TokenType.Identifier ) {
					Lexer.surprise (
						token,
						'function parameter list',
						'either identifier serving as argument name or closing parentheses'
					);
				}

				IdentifierToken.ensureNonKeyword ( parser, token, 'function parameter', isStrictScope );

				if ( isStrictScope )
					FunctionParser.checkForDuplicateParams ( <IdentifierToken> token, paramNameHashSet );

				Parser.builtin.push.call ( paramTokens, token );
				var paramExpr = builder.identifier ( token.value, parser.locByToken ( token ) );
				Parser.builtin.push.call ( params, paramExpr );
				token = lexer.read ();
			} while ( PunctuatorToken.match ( token, Punctuator.Comma ) );

			PunctuatorToken.expect ( lexer, Punctuator.RParen );
		}

		// Parse function body.
		var bodyLocStart = lexer.token.loc.start;
		PunctuatorToken.expect ( lexer, Punctuator.LCurly );

		var funcScope = parser.enterLexicalScope ();
		funcScope.inFunction = true;
		funcScope.inIteration = false;
		funcScope.inSwitch = false;
		funcScope.labels = Parser.builtin.create ( null );
		funcScope.funcData = {
			funcIdToken : funcIdToken,
			paramTokens : paramTokens
		};

		var statements : any [];

		try {
			statements = StatementParser.parseTopLevelStatements ( parser );
		} finally {
			parser.exitLexicalScope ();
		}

		PunctuatorToken.expect ( lexer, Punctuator.RCurly );

		var bodyBlock = builder.blockStatement ( statements, parser.createLoc ( bodyLocStart ) ),
			builderCb = isExpression ? builder.functionExpression : builder.functionDeclaration;

		return	builderCb.call ( builder, idExpr, params, bodyBlock, false, isExpression, parser.createLoc ( locStart ) );
	}

	public static validateStrictLimitations ( parser : Parser ) {
		var funcData = parser.scope.funcData,
			funcIdToken : IdentifierToken = funcData.funcIdToken;

		if ( funcIdToken !== null ) {
			/* Docs/Ecma-262.pdf, "Annex C (informative) The Strict Mode of ECMAScript":
			 * It is a SyntaxError to use within strict mode code the identifiers
			 * eval or arguments as the Identifier of a FunctionDeclaration or FunctionExpression
			 * or as a formal parameter name (13.1). */
			IdentifierToken.ensureNonKeyword ( parser, funcIdToken, 'function name' );
		}

		var paramTokens : IdentifierToken [] = funcData.paramTokens,
			paramNameHashSet : ParamNameHashSet = Parser.builtin.create ( null );

		for ( var i = 0 ; i < paramTokens.length ; i++ ) {
			var token = paramTokens [i];
			IdentifierToken.ensureNonKeyword ( parser, token, 'function parameter' );
			FunctionParser.checkForDuplicateParams ( token, paramNameHashSet );
		}
	}

	private static checkForDuplicateParams ( paramToken : IdentifierToken, paramNameHashSet : ParamNameHashSet ) {
		var paramName = <string> paramToken.value,
			safeParamName = ' ' + paramName;	// Avoid collisions with '__proto__'.

		if ( safeParamName in paramNameHashSet ) {
			/* Docs/Ecma-262.pdf, "Annex C (informative) The Strict Mode of ECMAScript":
			 * A strict mode function may not have two or more formal parameters that
			 * have the same name. An attempt to create such a function using a FunctionDeclaration,
			 * FunctionExpression, or Function constructor is a SyntaxError (13.1, 15.3.2). */
			Lexer.syntaxError (
				paramToken,
				'Strict mode function may not have duplicate parameter names' +
				' (parameter "' + paramName + '")'
			);
		} else
			paramNameHashSet [safeParamName] = true;
	}
}