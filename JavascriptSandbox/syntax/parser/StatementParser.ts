/// <reference path="Parser.ts" />
/// <reference path="ExpressionParser.ts" />
'use strict';

interface KeywordParserMap {
	[keyword : string] : ( parser : Parser ) => any;
}

interface ParseVarDeclOutData {
	/** This flas is set to true after parseVariableDeclaration () call
	  * when resulting variable declaration is suitable for for..in loop,
	  * i.e. when parsing of init expression was stopped on 'in' operator. */
	itWasForInVarDecl : bool;
}

class StatementParser {
	/** Depth of the current statement
	  * in context of the statement tree. */
	public static depth : number = 0;

	public static parse ( parser : Parser ) {
		StatementParser.depth++;

		try {
			var token = parser.lexer.token;

			if ( token.type === TokenType.Identifier ) {
				if ( token.kind === IdentifierKind.Keyword ||
					 token.kind === IdentifierKind.FutureReservedWord ||
					 token.kind === IdentifierKind.StrictFutureReservedWord )
				{
					var word = <string> token.value,
						parserFunc = word !== '__proto__' ? StatementParser.keywordParserMap [word] : undefined;

					if ( parserFunc ) {
						if ( ( word === 'let' && !parser.parseLet ) ||
							 ( word === 'const' && !parser.parseConst ) )
						{
							// These words will be treated as part of expression statement.
						} else
							return	parserFunc ( parser );
					}
				}

				// Check for labeled statement:
				if ( token.kind === IdentifierKind.Name ||
					 token.kind === IdentifierKind.StrictFutureReservedWord )
				{
					var nextToken = parser.lexer.read ();
					parser.lexer.stepBackward ();

					if ( nextToken.type === TokenType.Punctuator &&
						 nextToken.kind === Punctuator.Colon )
					{
						return	StatementParser.parseLabeledStatement ( parser );
					}
				}
			} else if ( token.type === TokenType.Punctuator ) {
				if ( token.kind === Punctuator.LCurly )
					return	StatementParser.parseBlock ( parser );
				else if ( token.kind === Punctuator.RCurly )
					return	null;
				else if ( token.kind === Punctuator.Semicolon )
					return	StatementParser.parseEmptyStatement ( parser );
			} else if ( token.type === TokenType.EOF )
				return	null;

			return	StatementParser.parseExpressionStatement ( parser );
		} finally {
			StatementParser.depth--;
		}
	}

	public static parseTopLevelStatements ( parser : Parser ) {
		var lexer = parser.lexer,
			token = lexer.token,
			scope = parser.scope,
			statements : any [] = [],
			statement : any,
			precedingOctalDirective : StringToken = null,
			readingDirectives = true;

		while ( !PunctuatorToken.match ( token, Punctuator.RCurly ) &&
				token.type !== TokenType.EOF
		) {
			if ( !scope.isStrict && readingDirectives ) {
				if ( token.type === TokenType.StringLiteral &&
					 ExpressionParser.tokenIsSingleTermExpressionStatement ( parser )
				) {
					var directive = Lexer.builtin.substring.call ( lexer.code,
						token.loc.start.index + 1, token.loc.end.index - 1 );

					if ( directive === 'use strict' ) {
						scope.isStrict = true;

						if ( scope.funcData )
							FunctionParser.validateStrictLimitations ( parser );

						if ( precedingOctalDirective ) {
							/* TODO: it's the same error as in Parser.validateEscapeSeqs ().
							 * Make error description constant or extract throwing of this error to separate method. */
							Lexer.syntaxError (
								precedingOctalDirective,
								'Octal escape sequences are not allowed in strict mode'
							);
						}
					} else if ( precedingOctalDirective === null &&
								token.kind === StringTokenKind.WithOctalEscapeSequence )
					{
						precedingOctalDirective = <StringToken> token;
					}
				} else /* if token is not string literal */
					readingDirectives = false;
			}

			statement = StatementParser.parse ( parser );
			Parser.builtin.push.call ( statements, statement );
			token = lexer.token;
		}

		return	statements;
	}

	private static parseBreak ( parser : Parser ) {
		return	StatementParser.parseJump ( parser, true );
	}

	private static parseContinue ( parser : Parser ) {
		return	StatementParser.parseJump ( parser, false );
	}

	// Generalized method for parsing 'break' and 'continue'
	private static parseJump ( parser : Parser, isBreak : bool ) {
		if ( Parser.DEBUG ) {
			System.assert (
				IdentifierToken.matchKeyword ( parser.lexer.token, 'break' ) ||
				IdentifierToken.matchKeyword ( parser.lexer.token, 'continue' )
			);
		}

		var lexer = parser.lexer,
			builder = parser.builder,
			locStart = lexer.token.loc.start,
			labelId : any = null,
			token = lexer.read ();
		
		if ( !StatementParser.isAutomaticSemicolonInsertable ( parser ) ) {
			if ( token.type === TokenType.Identifier ) {
				IdentifierToken.ensureNonKeyword (
					parser, token, 'label name',
					false	// Do not prohibit names 'eval' and 'arguments'.
				);

				var labelName = <string> token.value,
					safeLabelName = ' ' + labelName,	// Avoid collisions with '__proto__'.
					labelDict = parser.scope.labels;

				if ( !( safeLabelName in labelDict ) ) {
					Lexer.syntaxError (
						token,
						'Label "' + labelName + '" is not exists in current scope'
					);
				} else if ( !isBreak && !labelDict [safeLabelName].enclosesIteration ) {
					Lexer.syntaxError (
						token,
						'Label "' + labelName + '" exists but encloses not an iteration statement'
					);
				}

				labelId = builder.identifier ( labelName, parser.locByToken ( token ) );
				lexer.read ();
			} else {
				Lexer.surprise (
					token,
					'place of label name',
					'identifier serving as label name'
				);
			}
		} else /*if end of statement */ {
			if ( !parser.scope.inIteration && !parser.scope.inSwitch ) {
				Lexer.syntaxError (
					token,
					( isBreak ? 'break' : 'continue' ) +
						' statement without label is only allowed in the body of loop' +
						( isBreak ? ' or switch' : '' )
				);
			}
		}

		StatementParser.parseEndOfStatement ( parser );
		var builderCb = isBreak ? builder.breakStatement : builder.continueStatement;

		return	builderCb.call ( builder, labelId, parser.createLoc ( locStart ) );
	}

	private static parseDebugger ( parser : Parser ) {
		if ( Parser.DEBUG )
			System.assert ( IdentifierToken.matchKeyword ( parser.lexer.token, 'debugger' ) );

		var lexer = parser.lexer,
			statement = parser.builder.debuggerStatement ( parser.locByToken ( lexer.token ) );

		lexer.read ();
		StatementParser.parseEndOfStatement ( parser );

		return	statement;
	}

	private static parseDoWhile ( parser : Parser ) {
		if ( Parser.DEBUG )
			System.assert ( IdentifierToken.matchKeyword ( parser.lexer.token, 'do' ) );

		var lexer = parser.lexer,
			locStart = lexer.token.loc.start;

		StatementParser.enterIterationScope ( parser );
		var bodyStatement : any, testExpr : any;

		try {
			lexer.read ();
			bodyStatement = StatementParser.expectBlockOrStatement ( parser );
			IdentifierToken.expectKeyword ( lexer, 'while' );
			PunctuatorToken.expect ( lexer, Punctuator.LParen );
			testExpr = ExpressionParser.parse ( parser );
			PunctuatorToken.expect ( lexer, Punctuator.RParen );
			StatementParser.parseEndOfStatement ( parser );
		} finally {
			parser.exitLexicalScope ();
		}

		return	parser.builder.doWhileStatement ( bodyStatement, testExpr, parser.createLoc ( locStart ) );
	}

	private static parseFor ( parser : Parser ) {
		if ( Parser.DEBUG )
			System.assert ( IdentifierToken.matchKeyword ( parser.lexer.token, 'for' ) );

		var lexer = parser.lexer,
			locStart = lexer.token.loc.start;
		
		StatementParser.enterIterationScope ( parser );

		try {
			lexer.read ();
			PunctuatorToken.expect ( lexer, Punctuator.LParen );
			var token = lexer.token;
		
			var firstExprOrDecl : any,
				isForInLoop : bool;

			if ( PunctuatorToken.match ( lexer.token, Punctuator.Semicolon ) ) {
				firstExprOrDecl = null;
				isForInLoop = false;
			} else if ( token.value === 'var' ||
						( token.value === 'let' && parser.parseLet ) ||
						( token.value === 'const' && parser.parseConst )
			) {
				var outData = <ParseVarDeclOutData> {};
				firstExprOrDecl = StatementParser.parseVariableDeclaration (
					parser,
					true,	// isForLoopVar
					outData
				);
				isForInLoop = outData.itWasForInVarDecl;
			} else {
				// Parse expression, treat top-level 'in' keyword as "stop sign".
				var parseExprData = <ParseExprInOutData> {
					in_StopOnInOperator : true,
					out_StoppedOnInOperator : false
				};

				firstExprOrDecl = ExpressionParser.parse (
					parser,
					parseExprData
				);
				isForInLoop = parseExprData.out_StoppedOnInOperator;
			}

			if ( isForInLoop ) {
				if ( Parser.DEBUG )
					System.assert ( IdentifierToken.matchKeyword ( parser.lexer.token, 'in' ) );

				// Step over 'in' keyword.
				lexer.read ();
				var rightExpr = ExpressionParser.parse ( parser );
				PunctuatorToken.expect ( lexer, Punctuator.RParen );
				var bodyStatement = StatementParser.expectBlockOrStatement ( parser );

				return	parser.builder.forInStatement ( firstExprOrDecl, rightExpr, bodyStatement, false, parser.createLoc ( locStart ) );
			} else {	// This is for (;;) loop.
				PunctuatorToken.expect ( lexer, Punctuator.Semicolon );

				var testExpr : any;

				if ( PunctuatorToken.match ( lexer.token, Punctuator.Semicolon ) ) {
					testExpr = null;
					lexer.read ();
				} else {
					testExpr = ExpressionParser.parse ( parser );
					PunctuatorToken.expect ( lexer, Punctuator.Semicolon );
				}

				var updateExpr : any;

				if ( PunctuatorToken.match ( lexer.token, Punctuator.RParen ) ) {
					updateExpr = null;
					lexer.read ();
				} else {
					updateExpr = ExpressionParser.parse ( parser );
					PunctuatorToken.expect ( lexer, Punctuator.RParen );
				}

				var bodyStatement = StatementParser.expectBlockOrStatement ( parser );

				return	parser.builder.forStatement ( firstExprOrDecl, testExpr, updateExpr, bodyStatement, parser.createLoc ( locStart ) );
			}
		} finally {
			parser.exitLexicalScope ();
		}
	}

	private static parseFunctionDeclaration ( parser : Parser ) {
		return	FunctionParser.parseFunction ( parser, false );
	}

	private static parseIf ( parser : Parser ) {
		if ( Parser.DEBUG )
			System.assert ( IdentifierToken.matchKeyword ( parser.lexer.token, 'if' ) );

		var lexer = parser.lexer,
			locStart = lexer.token.loc.start;

		lexer.read ();
		PunctuatorToken.expect ( lexer, Punctuator.LParen );
		var testExpr = ExpressionParser.parse ( parser );
		PunctuatorToken.expect ( lexer, Punctuator.RParen );
		var consStatement = StatementParser.expectBlockOrStatement ( parser ),
			altStatement : any = null;

		if ( IdentifierToken.matchKeyword ( lexer.token, 'else' ) ) {
			lexer.read ();
			altStatement = StatementParser.expectBlockOrStatement ( parser );
		}

		return	parser.builder.ifStatement ( testExpr, consStatement, altStatement, parser.createLoc ( locStart ) );
	}

	private static parseReturn ( parser : Parser ) {
		if ( Parser.DEBUG )
			System.assert ( IdentifierToken.matchKeyword ( parser.lexer.token, 'return' ) );
		
		var lexer = parser.lexer,
			keywordToken = lexer.token;

		if ( !parser.scope.inFunction ) {
			Lexer.syntaxError (
				keywordToken,
				'return statement is only allowed in function body'
			);
		}

		var locStart = lexer.token.loc.start,
			argExpr : any = null;

		lexer.read ();
		
		if ( !StatementParser.isAutomaticSemicolonInsertable ( parser ) )
			argExpr = ExpressionParser.parse ( parser );

		StatementParser.parseEndOfStatement ( parser );

		return	parser.builder.returnStatement ( argExpr, parser.createLoc ( locStart ) );
	}

	private static parseSwitch ( parser : Parser ) {
		if ( Parser.DEBUG )
			System.assert ( IdentifierToken.matchKeyword ( parser.lexer.token, 'switch' ) );

		var lexer = parser.lexer,
			builder = parser.builder,
			locStart = lexer.token.loc.start;

		lexer.read ();
		PunctuatorToken.expect ( lexer, Punctuator.LParen );
		var discExpr = ExpressionParser.parse ( parser );
		PunctuatorToken.expect ( lexer, Punctuator.RParen );

		PunctuatorToken.expect ( lexer, Punctuator.LCurly );
		var switchScope = parser.enterLexicalScope ();
		switchScope.inSwitch = true;
		var cases : any [] = [];

		try {
			var hasDefaultCase = false;
		
			while ( !PunctuatorToken.match ( lexer.token, Punctuator.RCurly ) ) {
				var token = lexer.token,
					caseLocStart = lexer.token.loc.start,
					testExpr : any;

				if ( IdentifierToken.matchKeyword ( token, 'case' ) ) {
					lexer.read ();
					testExpr = ExpressionParser.parse ( parser );
				} else if ( IdentifierToken.matchKeyword ( token, 'default' ) ) {
					if ( hasDefaultCase ) {
						Lexer.syntaxError (
							token,
							'More than one default clause in switch statement'
						);
					}

					testExpr = null;
					hasDefaultCase = true;
					lexer.read ();
				} else {
					Lexer.surprise (
						token,
						'switch statement',
						'case or default keyword'
					);
				}

				PunctuatorToken.expect ( lexer, Punctuator.Colon );
				var statements : any [] = [];

				do {
					var statement : any,
						token = lexer.token;
				
					if ( token.type === TokenType.Identifier &&
						 token.kind === IdentifierKind.Keyword &&
						 ( token.value === 'case' ||
						   token.value === 'default' )
					) {
						statement = null;
					} else
						statement = StatementParser.parse ( parser );

					if ( statement !== null )
						Parser.builtin.push.call ( statements, statement );
				} while ( statement !== null );

				var caseClause = builder.switchCase ( testExpr, statements, parser.createLoc ( caseLocStart ) );
				Parser.builtin.push.call ( cases, caseClause );
			}

			// Step over closing '}'.
			lexer.read ();
		} finally {
			parser.exitLexicalScope ();
		}

		return	builder.switchStatement ( discExpr, cases, false /*TODO: implement*/, parser.createLoc ( locStart ) );
	}

	private static parseThrow ( parser : Parser ) {
		if ( Parser.DEBUG )
			System.assert ( IdentifierToken.matchKeyword ( parser.lexer.token, 'throw' ) );

		var lexer = parser.lexer,
			locStart = lexer.token.loc.start,
			argExpr : any = null;

		lexer.read ();
		
		if ( !StatementParser.isAutomaticSemicolonInsertable ( parser ) )
			argExpr = ExpressionParser.parse ( parser );

		StatementParser.parseEndOfStatement ( parser );

		return	parser.builder.throwStatement ( argExpr, parser.createLoc ( locStart ) );
	}

	private static parseTry ( parser : Parser ) {
		if ( Parser.DEBUG )
			System.assert ( IdentifierToken.matchKeyword ( parser.lexer.token, 'try' ) );

		var lexer = parser.lexer,
			builder = parser.builder,
			locStart = lexer.token.loc.start;

		lexer.read ();
		var tryBlock = StatementParser.parseBlock ( parser );

		var token = lexer.token,
			catchClause : any = null;

		if ( IdentifierToken.matchKeyword ( lexer.token, 'catch' ) ) {
			var catchLocStart = lexer.token.loc.start;
			lexer.read ();
			PunctuatorToken.expect ( lexer, Punctuator.LParen );
			token = lexer.token;
			var catchVarId : any;

			if ( token.type === TokenType.Identifier ) {
				/* Docs/Ecma-262.pdf, "12.14 The try Statement" (12.14.1):
				 * It is a SyntaxError if a TryStatement with a Catch occurs
				 * within strict code and the Identifier of the Catch production
				 * is either "eval" or "arguments". */
				IdentifierToken.ensureNonKeyword ( parser, token, 'catch variable name', parser.scope.isStrict );
				catchVarId = builder.identifier ( token.value, parser.locByToken ( token ) );
				lexer.read ();
			} else {
				Lexer.surprise (
					token,
					'place of the catch variable name',
					'identifier'
				);
			}

			PunctuatorToken.expect ( lexer, Punctuator.RParen );
			var catchBlock = StatementParser.parseBlock ( parser );
			catchClause = builder.catchClause ( catchVarId, null, catchBlock, parser.createLoc ( catchLocStart ) );
		}

		var finallyBlock : any = null;
		
		if ( IdentifierToken.matchKeyword ( lexer.token, 'finally' ) ) {
			lexer.read ();
			finallyBlock = StatementParser.parseBlock ( parser );
		} else if ( catchClause === null ) {
			Lexer.syntaxError (
				lexer.token,
				'Missing catch or finally after try'
			);
		}

		return	builder.tryStatement (
			tryBlock,
			catchClause ? [catchClause] : [],
			finallyBlock,
			parser.createLoc ( locStart )
		);
	}

	private static parseVariableDeclaration ( parser : Parser,
		isForLoopVar = false, outData? : ParseVarDeclOutData )
	{
		/* Note: caller is responsible for checking whether
		 * 'const' and 'let' kinds are appropriate. */
		var lexer = parser.lexer,
			builder = parser.builder,
			kind = lexer.token.value;

		if ( Parser.DEBUG ) {
			System.assert (
				kind === 'var' ||
				kind === 'let' ||
				kind === 'const'
			);
		}

		var locStart = lexer.token.loc.start,
			contextName =
				kind === 'var' ? 'variable' :
				kind === 'const' ? 'constant' : 'let variable',
			continueReading = true,
			// const can be only in for (;;) loop.
			stopOnInOperator = isForLoopVar && kind !== 'const',
			decls : any [] = [];

		if ( outData )
			outData.itWasForInVarDecl = false;

		do {
			var token = lexer.read (),
				declLocStart = token.loc.start,
				varId : any;

			if ( token.type === TokenType.Identifier ) {
				/* Docs/Ecma-262.pdf, "12.2 Variable Statement" (12.2.1):
				 * It is a SyntaxError if a VariableDeclaration or VariableDeclarationNoIn
				 * occurs within strict code and its Identifier is eval or arguments (12.2.1). */
				IdentifierToken.ensureNonKeyword ( parser, token, contextName + ' name', parser.scope.isStrict );
				varId = builder.identifier ( token.value, parser.locByToken ( token ) );
			} else {
				Lexer.surprise (
					token,
					contextName + ' declaration',
					'identifier'
				);
			}

			lexer.read ();
			var initExpr = null;

			if ( PunctuatorToken.match ( lexer.token, Punctuator.Assign ) ) {
				lexer.read ();

				var parseExprData = <ParseExprInOutData> {
					in_StopOnInOperator : stopOnInOperator,
					out_StoppedOnInOperator : false
				};

				initExpr = ExpressionParser.parse ( parser, parseExprData, OpPrecedence.Comma );

				if ( stopOnInOperator ) {
					if ( parseExprData.out_StoppedOnInOperator ) {
						/* It's for..in variable declaration and there can be
						 * exactly one declarator. */
						continueReading = false;

						if ( outData )
							outData.itWasForInVarDecl = true;
					} else {
						/* It's definitely for (;;) loop variable declaration because
						 * first declarator's init expression parsing wasn't stopped by 'in' operator. */
						stopOnInOperator = false;
					}
				}
			} else {
				if ( stopOnInOperator ) {
					if ( IdentifierToken.matchKeyword ( lexer.token, 'in' ) ) {
						/* This single initless declaration is for..in variable
						 * declaration. Stop reading because for..in accepts
						 * exactly one declarator. */
						continueReading = false;

						if ( outData )
							outData.itWasForInVarDecl = true;
					} else {
						/* There was no 'in' operator, so it is the variable declaration
						 * comprising of either single initless declarator or
						 * initless declarator followed by comma and more declarators.
						 * In either case this definitely is not a for..in variable and
						 * there is no reason to stop on 'in' operator while reading
						 * consequent declarators. */
						stopOnInOperator = false;
					}
				}
			}

			var decl = builder.variableDeclarator ( varId, initExpr, parser.createLoc ( declLocStart ) );
			Parser.builtin.push.call ( decls, decl );
			
			if ( continueReading &&
				!PunctuatorToken.match ( lexer.token, Punctuator.Comma )
			) {
				if ( !isForLoopVar )
					StatementParser.parseEndOfStatement ( parser );

				continueReading = false;
			}
		} while ( continueReading );

		return	builder.variableDeclaration ( kind, decls, parser.createLoc ( locStart ) );
	}

	private static parseWhile ( parser : Parser ) {
		if ( Parser.DEBUG )
			System.assert ( IdentifierToken.matchKeyword ( parser.lexer.token, 'while' ) );

		var lexer = parser.lexer,
			locStart = lexer.token.loc.start;

		StatementParser.enterIterationScope ( parser );
		var testExpr : any, bodyStatement : any;

		try {
			lexer.read ();
			PunctuatorToken.expect ( lexer, Punctuator.LParen );
			testExpr = ExpressionParser.parse ( parser );
			PunctuatorToken.expect ( lexer, Punctuator.RParen );
			bodyStatement = StatementParser.expectBlockOrStatement ( parser );
		} finally {
			parser.exitLexicalScope ();
		}

		return	parser.builder.whileStatement ( testExpr, bodyStatement, parser.createLoc ( locStart ) );
	}

	private static parseWith ( parser : Parser ) {
		if ( Parser.DEBUG )
			System.assert ( IdentifierToken.matchKeyword ( parser.lexer.token, 'with' ) );

		var lexer = parser.lexer,
			locStart = lexer.token.loc.start;

		if ( parser.scope.isStrict ) {
			/* Docs/Ecma-262.pdf, "12.10 The with Statement" (12.10.1):
			 * Strict mode code may not include a WithStatement.
			 * The occurrence of a WithStatement in such a context is treated as a SyntaxError. */
			Lexer.syntaxError (
				lexer.token,
				'Strict mode code may not include a with statement'
			);
		}

		lexer.read ();
		PunctuatorToken.expect ( lexer, Punctuator.LParen );
		var objectExpr = ExpressionParser.parse ( parser );
		PunctuatorToken.expect ( lexer, Punctuator.RParen );
		var bodyStatement = StatementParser.expectBlockOrStatement ( parser );

		return	parser.builder.withStatement ( objectExpr, bodyStatement, parser.createLoc ( locStart ) );
	}

	private static parseLabeledStatement ( parser : Parser ) {
		if ( Parser.DEBUG )
			System.assert ( parser.lexer.token.type === TokenType.Identifier );

		/* Note: caller is responsible to check whether
		 * identifier is valid for labeled statement. */
		var lexer = parser.lexer,
			builder = parser.builder,
			locStart = lexer.token.loc.start,
			idToken = lexer.token;

		IdentifierToken.ensureNonKeyword (
			parser, idToken, 'label name',
			false	// Do not prohibit names 'eval' and 'arguments'.
		) ;

		var labelName = <string> idToken.value,
			safeLabelName = ' ' + labelName,	// Avoid collisions with '__proto__'.
			labelDict = parser.scope.labels;

		if ( safeLabelName in labelDict ) {
			Lexer.syntaxError (
				idToken,
				'Label "' + labelName + '" has already been declared'
			);
		}

		var labelId = builder.identifier ( labelName, parser.locByToken ( idToken ) );
		lexer.read ();

		labelDict [safeLabelName] = {
			enclosesIteration : false,	// It's just not yet determined.
			depth : StatementParser.depth
		};

		var bodyStatement : any;

		try {
			PunctuatorToken.expect ( lexer, Punctuator.Colon );
			bodyStatement = StatementParser.expectBlockOrStatement ( parser );
		} finally {
			delete labelDict [safeLabelName];
		}

		return	builder.labeledStatement ( labelId, bodyStatement, parser.createLoc ( locStart ) );
	}

	private static parseBlock ( parser : Parser ) {
		if ( Parser.DEBUG )
			System.assert ( PunctuatorToken.match ( parser.lexer.token, Punctuator.LCurly ) );

		var lexer = parser.lexer,
			locStart = lexer.token.loc.start;

		PunctuatorToken.expect ( lexer, Punctuator.LCurly );

		var statements : any [] = [],
			statement : any;

		while ( null !== ( statement = StatementParser.parse ( parser ) ) ) {
			Parser.builtin.push.call ( statements, statement );
		}

		PunctuatorToken.expect ( lexer, Punctuator.RCurly );

		return	parser.builder.blockStatement ( statements, parser.createLoc ( locStart ) );
	}

	/* This function expects to read at least one statement
	 * and suggests that it is most likely to be a block statement. */
	private static expectBlockOrStatement ( parser : Parser ) {
		var lexer = parser.lexer;

		if ( PunctuatorToken.match ( lexer.token, Punctuator.LCurly ) ) {
			StatementParser.depth++;

			try {
				return	StatementParser.parseBlock ( parser );
			} finally {
				StatementParser.depth--;
			}
		} else {
			var statement = StatementParser.parse ( parser );

			if ( statement === null )
				Lexer.surprise ( lexer.token, 'statement' );

			return	statement;
		}
	}

	private static parseEmptyStatement ( parser : Parser ) {
		if ( Parser.DEBUG )
			System.assert ( PunctuatorToken.match ( parser.lexer.token, Punctuator.Semicolon ) );

		var lexer = parser.lexer,
			statement = parser.builder.emptyStatement ( parser.locByToken ( lexer.token ) );

		lexer.read ();

		return	statement;
	}

	private static parseExpressionStatement ( parser : Parser ) {
		var lexer = parser.lexer,
			locStart = lexer.token.loc.start,
			expr = ExpressionParser.parse ( parser );

		StatementParser.parseEndOfStatement ( parser );
		
		return	parser.builder.expressionStatement ( expr, parser.createLoc ( locStart ) );
	}

	private static parseEndOfStatement ( parser : Parser ) {
		var lexer = parser.lexer,
			token = lexer.token;

		if ( PunctuatorToken.match ( token, Punctuator.Semicolon ) )
			lexer.read ();
		else if ( token.type !== TokenType.EOF &&
				  !PunctuatorToken.match ( token, Punctuator.RCurly )
		) {
			// Try perform automatic semicolon insertion.
			var curTokenLine = token.loc.start.line,
				prevTokenLine = token.prev.loc.start.line;

			if ( curTokenLine === prevTokenLine ) {
				// Can't insert semicolon between tokens on the same line.
				Lexer.surprise (
					token,
					'statement',
					'end of statement character ";"'
				);
			} // else: automatic semicolon insertion is appropriate here.
		}
	}

	private static isAutomaticSemicolonInsertable ( parser : Parser ) {
		var lexer = parser.lexer,
			token = lexer.token;

		if ( PunctuatorToken.match ( token, Punctuator.Semicolon ) )
			return	true;
		else if ( token.type !== TokenType.EOF &&
				  !PunctuatorToken.match ( token, Punctuator.RCurly )
		) {
			var curTokenLine = token.loc.start.line,
				prevTokenLine = token.prev.loc.start.line;

			if ( curTokenLine === prevTokenLine ) {
				// Can't insert semicolon between tokens on the same line.
				return	false;
			} // else: automatic semicolon insertion is appropriate here.
		}

		return	true;
	}

	/**
	  * Create iteration subscope.
	  * Walk over all immediate ancestor labels of the current
	  * iteration node, set the flag on each of them indicating that
	  * these nodes encloses iteration statement.
	  * E.g. in code 'labelA : { labelB : labelC : for (;;) {} }' labels
	  * 'labelB' and 'labelC' should be flagged because they are immediate
	  * ancestors of the for loop, whereas 'labelA' is not.
	  */
	private static enterIterationScope ( parser : Parser ) {
		var iterationScope = parser.enterLexicalScope ();
		iterationScope.inIteration = true;
		
		if ( StatementParser.depth <= 1 ) {
			/* Current statement is on top level,
			 * it cannot be enclosed with labeled statement. */
			return;
		}

		var immediateParentDepth = StatementParser.depth - 1,
			labelDict = parser.scope.labels,
			found : bool;

		do {
			// Seek for label that is an immediate parent for current node.
			found = false;

			for ( var safeLabelName in labelDict ) {
				var labelEntry = labelDict [safeLabelName];
				
				if ( labelEntry.depth === immediateParentDepth ) {
					labelEntry.enclosesIteration = true;
					immediateParentDepth--;
					found = true;

					break;
				}
			}
		} while ( found && immediateParentDepth > 0 );
	}

	private static keywordParserMap = <KeywordParserMap> System.toFrozenMap ( {
		'break' : StatementParser.parseBreak,
		'const' : StatementParser.parseVariableDeclaration,
		'continue' : StatementParser.parseContinue,
		'debugger' : StatementParser.parseDebugger,
		'do' : StatementParser.parseDoWhile,
		'for' : StatementParser.parseFor,
		'function' : StatementParser.parseFunctionDeclaration,
		'if' : StatementParser.parseIf,
		'let' : StatementParser.parseVariableDeclaration,
		'return' : StatementParser.parseReturn,
		'switch' : StatementParser.parseSwitch,
		'throw' : StatementParser.parseThrow,
		'try' : StatementParser.parseTry,
		'var' : StatementParser.parseVariableDeclaration,
		'while' : StatementParser.parseWhile,
		'with' : StatementParser.parseWith,
	} );
}