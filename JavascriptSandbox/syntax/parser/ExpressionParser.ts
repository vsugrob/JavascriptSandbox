/// <reference path="Parser.ts" />
/// <reference path="FunctionParser.ts" />
/// <reference path="OpPrecedence.ts" />
'use strict';

interface BinOpInfo {
	precedence : number;
	leftToRight : bool;		// Associativity.
	builderCbName : string;	// Name of the ast builder callback.
}

interface BinOpInfoMap {
	[op : string] : BinOpInfo;
}

interface ExpressionParserState {
	nextTokenIsNotOp : bool;
	nextOpInfo : BinOpInfo;
	stopOnInOperator : bool;
	stoppedOnInOperator : bool;
	braceBalance : number;
}

interface ParseExprInOutData {
	in_StopOnInOperator : bool;
	out_StoppedOnInOperator : bool;
}

class ExpressionParser {
	/* Following fields represents state of ExpressionParser.
	 * Important: if these fields are changed, pushState (), popState ()
	 * and ExpressionParserState must be changed accordingly. */
	private static nextTokenIsNotOp : bool;		// Signals that next token is not representing an operator.
	private static nextOpInfo : BinOpInfo;
	private static stopOnInOperator : bool;
	private static stoppedOnInOperator : bool;
	/** This counter increases when parser encounters open braces
	  * '[', '{' or '(' and decreases when it meets
	  * pairing close braces ']', '}' or ')'. */
	private static braceBalance : number;

	private static stateStack : ExpressionParserState [] = [];
	/** Counter which reflects recursion depth of the ExpressionParser.parse () calls. */
	private static recursionDepth = 0;

	/** This tracks last solitary identifier in order to be able
	  * to raise strict mode error such as deletion of unqualified identifier
	  * or assignment to "eval" or "arguments".
	  * See "Annex C" of Docs/Ecma-262.pdf for more info. */
	private static lastUnqualifiedIdentifierToken : IdentifierToken;

	public static parse ( parser : Parser,
		inOutData? : ParseExprInOutData,
		precedenceLimit = OpPrecedence.Least )
	{
		ExpressionParser.recursionDepth++;

		if ( ExpressionParser.recursionDepth > 1 )
			ExpressionParser.pushState ();

		try {
			ExpressionParser.nextTokenIsNotOp = false;
			ExpressionParser.nextOpInfo = null;

			if ( inOutData ) {
				ExpressionParser.stopOnInOperator = inOutData.in_StopOnInOperator;
				ExpressionParser.stoppedOnInOperator = false;
			} else
				ExpressionParser.stopOnInOperator = false;

			ExpressionParser.braceBalance = 0;

			return	ExpressionParser.parseExpressionSeries ( parser, precedenceLimit );
		} finally {
			if ( inOutData )
				inOutData.out_StoppedOnInOperator = ExpressionParser.stoppedOnInOperator;

			if ( ExpressionParser.recursionDepth > 1 )
				ExpressionParser.popState ();

			ExpressionParser.recursionDepth--;
		}
	}

	public static parseExpressionSeries ( parser : Parser, precedenceLimit : number ) {
		var lexer = parser.lexer,
			token = lexer.token,
			locStart = token.loc.start,
			builder = parser.builder,
			expr : any;

		ExpressionParser.lastUnqualifiedIdentifierToken = null;

		if ( token.type === TokenType.Identifier ) {
			if ( token.kind === IdentifierKind.BooleanLiteral ) {
				expr = builder.literal ( token.value === 'true', parser.locByToken ( token ) );
				lexer.read ();
			} else if ( token.kind === IdentifierKind.NullLiteral ) {
				expr = builder.literal ( null, parser.locByToken ( token ) );
				lexer.read ();
			} else if ( token.kind === IdentifierKind.Keyword ) {
				if ( token.value === 'this' ) {
					expr = builder.thisExpression ( parser.locByToken ( token ) );
					lexer.read ();
				} else if ( token.value === 'function' )
					expr = ExpressionParser.parseFunctionExpression ( parser );
				else if ( token.value === 'typeof' ||
						  token.value === 'delete' ||
						  token.value === 'void' )
				{
					expr = ExpressionParser.parseUnaryExpression ( parser );
				} else if ( token.value === 'new' )
					expr = ExpressionParser.parseNewExpression ( parser );
				else
					Lexer.surprise ( token, 'expression' );
			} else if ( token.kind === IdentifierKind.FutureReservedWord )
				Lexer.surprise ( token, 'expression' );
			else /*if ( token.kind === IdentifierKind.Name ||
						token.kind === IdentifierKind.StrictFutureReservedWord ) */
			{
				if ( parser.scope.isStrict &&
					token.kind === IdentifierKind.StrictFutureReservedWord )
				{
					Lexer.surprise ( token, 'expression' );
				}

				ExpressionParser.lastUnqualifiedIdentifierToken = <IdentifierToken> token;
				expr = builder.identifier ( token.value, parser.locByToken ( token ) );
				lexer.read ();
			}
		} else if ( token.type === TokenType.Punctuator ) {
			if ( token.kind === Punctuator.LCurly )
				expr = ExpressionParser.parseObjectExpression ( parser );
			else if ( token.kind === Punctuator.LParen )
				expr = ExpressionParser.parseGroupExpression ( parser );
			else if ( token.kind === Punctuator.LBracket ) {
				expr = ExpressionParser.parseArrayExpression ( parser );
			} else if ( token.kind === Punctuator.Plus ||
						token.kind === Punctuator.Minus ||
						token.kind === Punctuator.Not ||
						token.kind === Punctuator.BitNot )
			{
				expr = ExpressionParser.parseUnaryExpression ( parser );
			} else if ( token.kind === Punctuator.Increase ||
						token.kind === Punctuator.Decrease )
			{
				expr = ExpressionParser.parsePrefixUpdateExpression ( parser );
			} else if ( token.kind === Punctuator.AmbiguousSlash ) {
				token = lexer.resolveAmbiguousSlash ( false );
				expr = builder.literal ( token.value, parser.locByToken ( token ) );
				lexer.read ();
			} else
				Lexer.surprise ( token, 'expression' );
		} else if ( token.type === TokenType.EOF )
			Lexer.surprise ( token, 'expression' );
		else /*if ( token.type === TokenType.NumericLiteral ||
					token.type === TokenType.StringLiteral ||
					token.type === TokenType.RegularExpression )*/
		{
			parser.validateOctals ( token );
			expr = builder.literal ( token.value, parser.locByToken ( token ) );
			lexer.read ();
		}

		if ( ExpressionParser.nextTokenIsNotOp ) {
			/* Either parseUnaryExpression () or parsePrefixUpdateExpression ()
			 * called above has detected that expression is finished. */
			return	expr;
		}

		do {
			expr = ExpressionParser.parseOperatorAndOperand ( parser, expr, precedenceLimit, locStart );
		} while (
			!ExpressionParser.nextTokenIsNotOp &&
			( ExpressionParser.nextOpInfo === null ||
			  ExpressionParser.precedenceInLimit ( ExpressionParser.nextOpInfo, precedenceLimit ) )
		);

		return	expr;
	}

	private static parseOperatorAndOperand ( parser : Parser, leftExpr : any,
		precedenceLimit : number, locStart : SourcePosition )
	{
		var lexer = parser.lexer,
			builder = parser.builder,
			token = lexer.token;

		if ( token.type === TokenType.EOF ) {
			ExpressionParser.nextTokenIsNotOp = true;

			return	leftExpr;
		}
		
		/* TODO: use ExpressionParser.nextOpInfo when it is not null.
		 * This way we do not need to read next token, it was already parsed.
		 * UPD: before completing this todo-task, test
		 * http://localhost:22212/tools/parser-comarison/test/compare.html
		 * shows 245.8 ms in total. */
		if ( PunctuatorToken.match ( token, Punctuator.AmbiguousSlash ) )
			token = lexer.resolveAmbiguousSlash ( true );
		else if ( ExpressionParser.stopOnInOperator &&
				  ExpressionParser.braceBalance === 0 &&
				  IdentifierToken.matchKeyword ( token, 'in' )
		) {
			ExpressionParser.nextOpInfo = null;
			ExpressionParser.nextTokenIsNotOp = true;
			ExpressionParser.stoppedOnInOperator = true;

			return	leftExpr;
		}

		if ( token.type === TokenType.Punctuator ||
			 token.type === TokenType.Identifier )
		{
			var opStr = token.value,
				opInfo = opStr !== '__proto__' ? ExpressionParser.binOpPrecedenceMap [token.value] : undefined;

			if ( opInfo !== undefined ) {
				if ( !ExpressionParser.precedenceInLimit ( opInfo, precedenceLimit ) ) {
					ExpressionParser.nextOpInfo = opInfo;

					return	leftExpr;
				}

				var opExpr : any;
				
				if ( opStr === '.' )
					opExpr = ExpressionParser.parseDotMemberExpression ( parser, leftExpr, locStart );
				else if ( opStr === '(' )
					opExpr = ExpressionParser.parseCallExpression ( parser, leftExpr, locStart );
				else if ( opStr === '[' )
					opExpr = ExpressionParser.parseBracketMemberExpression ( parser, leftExpr, locStart );
				else if ( opStr === '++' || opStr === '--' ) {
					// Postfix update operator must be on the same line as its argument.
					if ( token.loc.start.line !== token.prev.loc.start.line ) {
						ExpressionParser.nextTokenIsNotOp = true;

						return	leftExpr;
					}

					opExpr = ExpressionParser.parsePostifxUpdateExpression ( parser, leftExpr, locStart );
				} else if ( opStr === ',' )
					opExpr = ExpressionParser.parseSequenceExpression ( parser, leftExpr, locStart );
				else if ( opStr === '?' )
					opExpr = ExpressionParser.parseConditionalExpression ( parser, leftExpr, locStart );
				else {
					if ( parser.scope.isStrict &&
						 null !== ExpressionParser.lastUnqualifiedIdentifierToken &&
						 opInfo.precedence === OpPrecedence.Assignment
					) {
						/* Docs/Ecma-262.pdf, "Annex C (informative) The Strict Mode of ECMAScript":
						 * The identifier eval or arguments may not appear as the LeftHandSideExpression
						 * of an Assignment operator (11.13) or of a PostfixExpression (11.3) or as the
						 * UnaryExpression operated upon by a Prefix Increment (11.4.4) or
						 * a Prefix Decrement (11.4.5) operator. */
						IdentifierToken.ensureNonEvalOrArgs (
							parser,
							ExpressionParser.lastUnqualifiedIdentifierToken,
							'left hand side of assignment'
						);
					}

					// Step over operator token.
					lexer.read ();
					var rightExpr = ExpressionParser.parseExpressionSeries ( parser, opInfo.precedence );

					if ( Parser.DEBUG )
						System.assert ( opInfo.builderCbName !== null );

					var builderCb = <Function> builder [opInfo.builderCbName];
					opExpr = builderCb.call ( builder, opStr, leftExpr, rightExpr, parser.createLoc ( locStart ) );
				}

				ExpressionParser.lastUnqualifiedIdentifierToken = null;

				return	opExpr;
			} // else: we've got non-operator token, it's the end of expression.
		}

		ExpressionParser.nextTokenIsNotOp = true;

		return	leftExpr;
	}

	private static precedenceInLimit ( opInfo : BinOpInfo, precedenceLimit : number ) {
		return	opInfo.leftToRight ?
			opInfo.precedence < precedenceLimit :
			opInfo.precedence <= precedenceLimit;
	}

	private static parseNewExpression ( parser : Parser ) {
		if ( Parser.DEBUG )
			System.assert ( IdentifierToken.matchKeyword ( parser.lexer.token, 'new' ) );

		var lexer = parser.lexer,
			locStart = lexer.token.loc.start;

		lexer.read ();

		var calleeExpr = ExpressionParser.parseExpressionSeries ( parser, OpPrecedence.Call ),
			args : any [];

		if ( PunctuatorToken.match ( lexer.token, Punctuator.LParen ) )
			args = ExpressionParser.parseCallArguments ( parser );
		else
			args = [];

		ExpressionParser.lastUnqualifiedIdentifierToken = null;

		return	parser.builder.newExpression ( calleeExpr, args, parser.createLoc ( locStart ) );
	}

	private static parseObjectExpression ( parser : Parser ) {
		if ( Parser.DEBUG )
			System.assert ( PunctuatorToken.match ( parser.lexer.token, Punctuator.LCurly ) );

		var lexer = parser.lexer,
			locStart = lexer.token.loc.start,
			builder = parser.builder,
			props = [],
			keyKindDict = Parser.builtin.create ( null );

		ExpressionParser.braceBalance++;
		lexer.read ();

		while ( !PunctuatorToken.match ( lexer.token, Punctuator.RCurly ) ) {
			var token = lexer.token,
				propertyLocStart = token.loc.start,
				kind = 'init';

			if ( token.type === TokenType.Identifier ) {
				if ( token.value === 'get' || token.value === 'set' ) {
					token = lexer.read ();

					if ( PunctuatorToken.match ( lexer.token, Punctuator.Colon ) ) {
						// It wasn't an accessor.
						token = lexer.stepBackward ();
					} else {
						var kindToken = token.prev;
						kind = kindToken.value;
					}
				}
			}

			var keyExpr : any;

			if ( token.type === TokenType.StringLiteral ||
				 token.type === TokenType.NumericLiteral )
			{
				parser.validateOctals ( token );
				keyExpr = builder.literal ( token.value, parser.locByToken ( token ) );
			} else if ( token.type === TokenType.Identifier )
				keyExpr = builder.identifier ( token.value, parser.locByToken ( token ) );
			else {
				Lexer.surprise (
					token,
					'object expression',
					'identifier or string literal'
				);
			}

			var key = Parser.builtin.String ( token.value ),
				safeKey = ' ' + key;	// Avoid collisions with '__proto__'.

			if ( safeKey in keyKindDict ) {
				var existingKind = keyKindDict [safeKey],
					errorMessage = null;

				if ( kind === existingKind ) {
					if ( kind === 'init' ) {
						if ( parser.scope.isStrict ) {
							/* Docs/Ecma-262.pdf, "Annex C (informative) The Strict Mode of ECMAScript":
							 * It is a SyntaxError if strict mode code contains an ObjectLiteral
							 * with more than one definition of any data property (11.1.5). */
							errorMessage = 'Duplicate data property in object literal not allowed in strict mode';
						}
					} else
						errorMessage = 'Object literal may not have multiple get/set accessors with the same name';
				} else if ( kind === 'init' || existingKind === 'init' )
					errorMessage = 'Object literal may not have data and accessor property with the same name';

				if ( errorMessage ) {
					Lexer.syntaxError (
						token,
						errorMessage + ' (key : "' + key + '")'
					);
				}
			} else
				keyKindDict [safeKey] = kind;

			var valueExpr : any;
			lexer.read ();

			if ( kind === 'init' ) {
				PunctuatorToken.expect ( lexer, Punctuator.Colon );
				valueExpr = ExpressionParser.parseExpressionSeries ( parser, OpPrecedence.Comma );
			} else {
				PunctuatorToken.expect ( lexer, Punctuator.LParen, false );
				valueExpr = FunctionParser.parserHeadlessFunction (
					parser,
					null,	// idExpr
					null,	// funcIdToken
					true	// isExpression
				);
			}

			var propertyNode = builder.property ( kind, keyExpr, valueExpr, parser.createLoc ( propertyLocStart ) );
			Parser.builtin.push.call ( props, propertyNode );

			// Step over trailing comma.
			if ( PunctuatorToken.match ( lexer.token, Punctuator.Comma ) )
				lexer.read ();
		}

		// Step over closing curly brace.
		lexer.read ();

		/* Reset flag because right curly brace is not the end of expression,
		 * it is the operator. */
		ExpressionParser.nextTokenIsNotOp = false;
		ExpressionParser.nextOpInfo = null;
		ExpressionParser.lastUnqualifiedIdentifierToken = null;
		ExpressionParser.braceBalance--;

		return	parser.builder.objectExpression ( props, parser.createLoc ( locStart ) );
	}

	private static parseGroupExpression ( parser : Parser ) {
		if ( Parser.DEBUG )
			System.assert ( PunctuatorToken.match ( parser.lexer.token, Punctuator.LParen ) );

		var lexer = parser.lexer;
		ExpressionParser.braceBalance++;
		lexer.read ();
		var expr = ExpressionParser.parseExpressionSeries ( parser, OpPrecedence.Least );
		PunctuatorToken.expect ( lexer, Punctuator.RParen );
		/* Reset flag because right parentheses is not the end of expression,
		 * it is the operator. */
		ExpressionParser.nextTokenIsNotOp = false;
		ExpressionParser.nextOpInfo = null;
		ExpressionParser.braceBalance--;

		return	expr;
	}

	private static parseArrayExpression ( parser : Parser ) {
		if ( Parser.DEBUG )
			System.assert ( PunctuatorToken.match ( parser.lexer.token, Punctuator.LBracket ) );

		var lexer = parser.lexer,
			locStart = lexer.token.loc.start,
			elements = [];

		ExpressionParser.braceBalance++;

		do {
			lexer.read ();

			if ( PunctuatorToken.match ( lexer.token, Punctuator.Comma ) ) {
				// Empty element, like [,].
				Parser.builtin.push.call ( elements, null );
			} else if ( PunctuatorToken.match ( lexer.token, Punctuator.RBracket ) ) {
				// Trailing comma does not contribute to elements. [a,] is array of one element.
				break;
			} else {
				var expr = ExpressionParser.parseExpressionSeries ( parser, OpPrecedence.Comma );
				Parser.builtin.push.call ( elements, expr );
			}
		} while ( PunctuatorToken.match ( lexer.token, Punctuator.Comma ) );

		PunctuatorToken.expect ( lexer, Punctuator.RBracket );
		/* Reset flag because right bracket is not the end of expression,
		 * it is the operator. */
		ExpressionParser.nextTokenIsNotOp = false;
		ExpressionParser.nextOpInfo = null;
		ExpressionParser.lastUnqualifiedIdentifierToken = null;
		ExpressionParser.braceBalance--;

		return	parser.builder.arrayExpression ( elements, parser.createLoc ( locStart ) );
	}

	private static parseFunctionExpression ( parser : Parser ) {
		ExpressionParser.braceBalance++;
		var funcExpr = FunctionParser.parseFunction (
			parser,
			true	// isExpression
		);
		ExpressionParser.braceBalance--;

		/* Reset flag because right curly brace is not the end of expression,
		 * it is the operator. */
		ExpressionParser.nextTokenIsNotOp = false;
		ExpressionParser.nextOpInfo = null;
		ExpressionParser.lastUnqualifiedIdentifierToken = null;

		return	funcExpr;
	}

	private static parseUnaryExpression ( parser : Parser ) {
		var lexer = parser.lexer,
			token = lexer.token;
		
		if ( Parser.DEBUG ) {
			System.assert (
				( token.type === TokenType.Identifier &&
				  token.kind === IdentifierKind.Keyword &&
				  ( token.value === 'typeof' ||
					token.value === 'delete' ||
					token.value === 'void' )
				) ||
				( token.type === TokenType.Punctuator &&
				  ( token.kind === Punctuator.Plus ||
					token.kind === Punctuator.Minus ||
					token.kind === Punctuator.Not ||
					token.kind === Punctuator.BitNot )
				)
			);
		}

		/* TODO: locStart isn't needed before strict checks made.
		 * Define such variables later, in order of their necessity.
		 * This TODO is project-wide. */
		var locStart = token.loc.start,
			operator = <string> parser.lexer.token.value;

		lexer.read ();

		var argExpr = ExpressionParser.parseExpressionSeries ( parser, OpPrecedence.Unary );

		if ( parser.scope.isStrict &&
			 operator === 'delete' &&
			 null !== ExpressionParser.lastUnqualifiedIdentifierToken
		) {
			/* Docs/Ecma-262.pdf, "11.4.1 The delete Operator":
			 * When a delete operator occurs within strict mode code, a SyntaxError exception
			 * is thrown if its UnaryExpression is a direct reference to a variable,
			 * function argument, or function name. */
			Lexer.syntaxError (
				ExpressionParser.lastUnqualifiedIdentifierToken,
				'Delete of an unqualified identifier in strict mode' +
				' (identifier "' + ExpressionParser.lastUnqualifiedIdentifierToken.value + '")'
			);
		}

		ExpressionParser.lastUnqualifiedIdentifierToken = null;

		return	parser.builder.unaryExpression (
			operator,
			argExpr,
			true,				// isPrefix
			parser.createLoc ( locStart )
		);
	}

	private static parsePrefixUpdateExpression ( parser : Parser ) {
		var lexer = parser.lexer,
			token = lexer.token;

		if ( Parser.DEBUG ) {
			System.assert (
				token.type === TokenType.Punctuator &&
				( token.kind === Punctuator.Increase ||
				  token.kind === Punctuator.Decrease )
			);
		}
		
		var locStart = token.loc.start,
			operator = token.value;

		lexer.read ();

		var argExpr = ExpressionParser.parseExpressionSeries ( parser, 3 );
		
		if ( parser.scope.isStrict &&
			 null !== ExpressionParser.lastUnqualifiedIdentifierToken
		) {
			IdentifierToken.ensureNonEvalOrArgs (
				parser,
				ExpressionParser.lastUnqualifiedIdentifierToken,
				'prefix update operand'
			);
		}

		ExpressionParser.lastUnqualifiedIdentifierToken = null;
		
		return	parser.builder.updateExpression (
			operator,
			argExpr,
			true,				// isPrefix
			parser.createLoc ( locStart )
		);
	}

	private static parsePostifxUpdateExpression ( parser : Parser, argExpr : any, locStart : SourcePosition ) {
		var token = parser.lexer.token;

		if ( Parser.DEBUG ) {
			System.assert (
				token.type === TokenType.Punctuator &&
				( token.kind === Punctuator.Increase ||
				  token.kind === Punctuator.Decrease )
			);
		}

		parser.lexer.read ();

		if ( parser.scope.isStrict &&
			 null !== ExpressionParser.lastUnqualifiedIdentifierToken
		) {
			IdentifierToken.ensureNonEvalOrArgs (
				parser,
				ExpressionParser.lastUnqualifiedIdentifierToken,
				'postfix update operand'
			);
		}

		ExpressionParser.nextOpInfo = null;
		
		return	parser.builder.updateExpression ( token.value, argExpr, false, parser.createLoc ( locStart ) );
	}

	private static parseDotMemberExpression ( parser : Parser, objectExpr : any, locStart : SourcePosition ) {
		if ( Parser.DEBUG )
			System.assert ( PunctuatorToken.match ( parser.lexer.token, Punctuator.Dot ) );

		var lexer = parser.lexer,
			builder = parser.builder,
			propertyIdToken = lexer.read (),
			idExpr : any;
		
		if ( propertyIdToken.type === TokenType.Identifier ) {
			idExpr = builder.identifier ( propertyIdToken.value, parser.locByToken ( propertyIdToken ) );
			lexer.read ();
		} else {
			Lexer.surprise (
				propertyIdToken,
				'place of object property name',
				'identifier'
			);
		}

		ExpressionParser.nextOpInfo = null;

		return	builder.memberExpression ( objectExpr, idExpr, false, parser.createLoc ( locStart ) );
	}

	private static parseCallExpression ( parser : Parser, calleeExpr : any, locStart : SourcePosition ) {
		var args = ExpressionParser.parseCallArguments ( parser );

		return	parser.builder.callExpression ( calleeExpr, args, parser.createLoc ( locStart ) );
	}

	private static parseCallArguments ( parser : Parser ) {
		if ( Parser.DEBUG )
			System.assert ( PunctuatorToken.match ( parser.lexer.token, Punctuator.LParen ) );

		var lexer = parser.lexer,
			args = [];

		lexer.read ();

		if ( PunctuatorToken.match ( lexer.token, Punctuator.RParen ) ) {
			// Empty parentheses '()'.
			lexer.read ();
		} else {
			lexer.stepBackward ();

			do {
				lexer.read ();
				var expr = ExpressionParser.parseExpressionSeries ( parser, OpPrecedence.Comma );
				Parser.builtin.push.call ( args, expr );
			} while ( PunctuatorToken.match ( lexer.token, Punctuator.Comma ) );

			PunctuatorToken.expect ( lexer, Punctuator.RParen );
		}

		/* Reset flag because right parentheses is not the end of expression,
		 * it is the operator. */
		ExpressionParser.nextTokenIsNotOp = false;
		ExpressionParser.nextOpInfo = null;

		return	args;
	}

	private static parseBracketMemberExpression ( parser : Parser, objectExpr : any, locStart : SourcePosition ) {
		if ( Parser.DEBUG )
			System.assert ( PunctuatorToken.match ( parser.lexer.token, Punctuator.LBracket ) );

		var lexer = parser.lexer;
		lexer.read ();
		var propertyExpr = ExpressionParser.parseExpressionSeries ( parser, OpPrecedence.Least );
		PunctuatorToken.expect ( lexer, Punctuator.RBracket );
		/* Reset flag because right bracket is not the end of expression,
		 * it is the operator. */
		ExpressionParser.nextTokenIsNotOp = false;
		ExpressionParser.nextOpInfo = null;

		return	parser.builder.memberExpression ( objectExpr, propertyExpr, true, parser.createLoc ( locStart ) );
	}

	private static parseSequenceExpression ( parser : Parser, firstExpr : any, locStart : SourcePosition ) {
		if ( Parser.DEBUG )
			System.assert ( PunctuatorToken.match ( parser.lexer.token, Punctuator.Comma ) );

		var lexer = parser.lexer,
			expressions = [firstExpr];

		do {
			lexer.read ();
			var expr = ExpressionParser.parseExpressionSeries ( parser, OpPrecedence.Comma );
			Parser.builtin.push.call ( expressions, expr );
		} while ( PunctuatorToken.match ( lexer.token, Punctuator.Comma ) );

		return	parser.builder.sequenceExpression ( expressions, parser.createLoc ( locStart ) );
	}

	private static parseConditionalExpression ( parser : Parser, testExpr : any, locStart : SourcePosition ) {
		if ( Parser.DEBUG )
			System.assert ( PunctuatorToken.match ( parser.lexer.token, Punctuator.Question ) );

		var lexer = parser.lexer;
		lexer.read ();
		var consExpr = ExpressionParser.parseExpressionSeries ( parser, OpPrecedence.Comma );

		PunctuatorToken.expect ( lexer, Punctuator.Colon );
		/* Reset flag because colon is not the end of expression,
		 * it is the operator. */
		ExpressionParser.nextTokenIsNotOp = false;
		ExpressionParser.nextOpInfo = null;
		var altExpr = ExpressionParser.parseExpressionSeries ( parser, OpPrecedence.Comma );

		return	parser.builder.conditionalExpression ( testExpr, consExpr, altExpr, parser.createLoc ( locStart ) );
	}

	private static pushState () {
		Parser.builtin.push.call ( ExpressionParser.stateStack, {
			nextTokenIsNotOp : ExpressionParser.nextTokenIsNotOp,
			nextOpInfo : ExpressionParser.nextOpInfo,
			stopOnInOperator : ExpressionParser.stopOnInOperator,
			stoppedOnInKeyword : ExpressionParser.stoppedOnInOperator,
			braceDepth : ExpressionParser.braceBalance
		} );
	}

	private static popState () {
		// Note: caller is responsible to check that stateStack is not empty.
		var state = <ExpressionParserState> Parser.builtin.pop.call ( ExpressionParser.stateStack );
		ExpressionParser.nextTokenIsNotOp = state.nextTokenIsNotOp;
		ExpressionParser.nextOpInfo = state.nextOpInfo;
		ExpressionParser.stopOnInOperator = state.stopOnInOperator;
		ExpressionParser.stoppedOnInOperator = state.stoppedOnInOperator;
		ExpressionParser.braceBalance = state.braceBalance;
	}

	/** Tests whether current token is expression statement consisting of single term. */
	public static tokenIsSingleTermExpressionStatement ( parser : Parser ) {
		var lexer = parser.lexer,
			nextToken = lexer.read ();

		lexer.stepBackward ();

		if ( nextToken.type === TokenType.Punctuator ||
			 nextToken.type === TokenType.Identifier )
		{
			var opStr = <string> nextToken.value;
			
			return	!Parser.builtin.hasOwnProperty.call ( ExpressionParser.binOpPrecedenceMap, opStr );
		}

		return	true;
	}

	/* This map was derived from
	 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Operator_Precedence#Table */
	private static binOpPrecedenceMap = <BinOpInfoMap> System.toFrozenMap ( {
		'.' : { precedence : OpPrecedence.Member, leftToRight : true, builderCbName : null },
		'[' : { precedence : OpPrecedence.Member, leftToRight : true, builderCbName : null },
		'(' : { precedence : OpPrecedence.Call, leftToRight : true, builderCbName : null },
		'++' : { precedence : OpPrecedence.Update, leftToRight : true, builderCbName : null },
		'--' : { precedence : OpPrecedence.Update, leftToRight : true, builderCbName : null },
		'*' : { precedence : OpPrecedence.MulDivMod, leftToRight : true, builderCbName : 'binaryExpression' },
		'/' : { precedence : OpPrecedence.MulDivMod, leftToRight : true, builderCbName : 'binaryExpression' },
		'%' : { precedence : OpPrecedence.MulDivMod, leftToRight : true, builderCbName : 'binaryExpression' },
		'+' : { precedence : OpPrecedence.AddSub, leftToRight : true, builderCbName : 'binaryExpression' },
		'-' : { precedence : OpPrecedence.AddSub, leftToRight : true, builderCbName : 'binaryExpression' },
		'<<' : { precedence : OpPrecedence.BitShift, leftToRight : true, builderCbName : 'binaryExpression' },
		'>>' : { precedence : OpPrecedence.BitShift, leftToRight : true, builderCbName : 'binaryExpression' },
		'>>>' : { precedence : OpPrecedence.BitShift, leftToRight : true, builderCbName : 'binaryExpression' },
		'<' : { precedence : OpPrecedence.Relational, leftToRight : true, builderCbName : 'binaryExpression' },
		'<=' : { precedence : OpPrecedence.Relational, leftToRight : true, builderCbName : 'binaryExpression' },
		'>' : { precedence : OpPrecedence.Relational, leftToRight : true, builderCbName : 'binaryExpression' },
		'>=' : { precedence : OpPrecedence.Relational, leftToRight : true, builderCbName : 'binaryExpression' },
		'in' : { precedence : OpPrecedence.Relational, leftToRight : true, builderCbName : 'binaryExpression' },
		'instanceof' : { precedence : OpPrecedence.Relational, leftToRight : true, builderCbName : 'binaryExpression' },
		'==' : { precedence : OpPrecedence.Equality, leftToRight : true, builderCbName : 'binaryExpression' },
		'!=' : { precedence : OpPrecedence.Equality, leftToRight : true, builderCbName : 'binaryExpression' },
		'===' : { precedence : OpPrecedence.Equality, leftToRight : true, builderCbName : 'binaryExpression' },
		'!==' : { precedence : OpPrecedence.Equality, leftToRight : true, builderCbName : 'binaryExpression' },
		'&' : { precedence : OpPrecedence.BitAnd, leftToRight : true, builderCbName : 'binaryExpression' },
		'^' : { precedence : OpPrecedence.BitXor, leftToRight : true, builderCbName : 'binaryExpression' },
		'|' : { precedence : OpPrecedence.BitOr, leftToRight : true, builderCbName : 'binaryExpression' },
		'&&' : { precedence : OpPrecedence.LogicalAnd, leftToRight : true, builderCbName : 'logicalExpression' },
		'||' : { precedence : OpPrecedence.LogicalOr, leftToRight : true, builderCbName : 'logicalExpression' },
		'?' : { precedence : OpPrecedence.Conditional, leftToRight : false, builderCbName : null },
		'=' : { precedence : OpPrecedence.Assignment, leftToRight : false, builderCbName : 'assignmentExpression' },
		'+=' : { precedence : OpPrecedence.Assignment, leftToRight : false, builderCbName : 'assignmentExpression' },
		'-=' : { precedence : OpPrecedence.Assignment, leftToRight : false, builderCbName : 'assignmentExpression' },
		'*=' : { precedence : OpPrecedence.Assignment, leftToRight : false, builderCbName : 'assignmentExpression' },
		'/=' : { precedence : OpPrecedence.Assignment, leftToRight : false, builderCbName : 'assignmentExpression' },
		'%=' : { precedence : OpPrecedence.Assignment, leftToRight : false, builderCbName : 'assignmentExpression' },
		'<<=' : { precedence : OpPrecedence.Assignment, leftToRight : false, builderCbName : 'assignmentExpression' },
		'>>=' : { precedence : OpPrecedence.Assignment, leftToRight : false, builderCbName : 'assignmentExpression' },
		'>>>=' : { precedence : OpPrecedence.Assignment, leftToRight : false, builderCbName : 'assignmentExpression' },
		'&=' : { precedence : OpPrecedence.Assignment, leftToRight : false, builderCbName : 'assignmentExpression' },
		'^=' : { precedence : OpPrecedence.Assignment, leftToRight : false, builderCbName : 'assignmentExpression' },
		'|=' : { precedence : OpPrecedence.Assignment, leftToRight : false, builderCbName : 'assignmentExpression' },
		',' : { precedence : OpPrecedence.Comma, leftToRight : true, builderCbName : null },
	} );
}