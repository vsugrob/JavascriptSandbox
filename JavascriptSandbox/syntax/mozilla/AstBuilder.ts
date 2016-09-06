/// <reference path="../SourceLocation.ts" />
'use strict';

/* TODO: implement class that accepts mozilla ast
 * and acts like parser: walk the tree in depth-first order
 * and invoke builder callbacks.*/
interface AstBuilder {
	// Programs:
	program? ( body : any [], loc? : SourceLocation );

	// Statements:
	emptyStatement? ( loc? : SourceLocation );
	blockStatement? ( body : any [], loc? : SourceLocation );
	expressionStatement? ( expr : any, loc? : SourceLocation );
	labeledStatement? ( label : any, body : any, loc? : SourceLocation );
	// alt can be null.
	ifStatement? ( test : any, cons : any, alt : any, loc? : SourceLocation );
	/* The isLexical flag is metadata indicating whether the switch statement
	 * contains any unnested let declarations (and therefore introduces a new lexical scope). */
	switchStatement? ( disc : any, cases : any [], isLexical : bool, loc? : SourceLocation );
	whileStatement? ( test : any, body : any, loc? : SourceLocation );
	doWhileStatement? ( body : any, test : any, loc? : SourceLocation );
	// init, test and update can be null.
	forStatement? ( init : any, test : any, update : any, body : any, loc? : SourceLocation );
	forInStatement? ( left : any, right : any, body : any, isForEach : bool, loc? : SourceLocation );
	// label can be null.
	breakStatement? ( label : any, loc? : SourceLocation );
	// label can be null.
	continueStatement? ( label : any, loc? : SourceLocation );
	withStatement? ( obj : any, body : any, loc? : SourceLocation );
	// arg can be null.
	returnStatement? ( arg : any, loc? : SourceLocation );
	// fin can be null.
	tryStatement? ( body : any, handlers : any [], fin : any, loc? : SourceLocation );
	throwStatement? ( arg : any, loc? : SourceLocation );
	debuggerStatement? ( loc? : SourceLocation );
	letStatement? ( head : any [], body : any, loc? : SourceLocation );

	// Declarations:
	functionDeclaration? ( id : any, args : any [], body : any, isGenerator : bool, isExpression : bool, loc? : SourceLocation );
	// kind can be "const" | "let" | "var".
	variableDeclaration? ( kind : string, dtors : any [], loc? : SourceLocation );
	// init can be null.
	variableDeclarator? ( id : any, init : any, loc? : SourceLocation );

	// Expressions:
	sequenceExpression? ( exprs : any [], loc? : SourceLocation );
	conditionalExpression? ( test : any, cons : any, alt : any, loc? : SourceLocation );
	// op can be  "-" | "+" | "!" | "~" | "typeof" | "void" | "delete".
	// TODO: why 'isPrefix' is there? Shouldn't it be always set to true?
	unaryExpression? ( op : string, arg : any, isPrefix : bool, loc? : SourceLocation );
	/* op can be "==" | "!=" | "===" | "!==" | "<" | "<=" | ">" | ">=" | "<<" | ">>" | ">>>" |
	 * "+" | "-" | "*" | "/" | "%" | "|" | "^" | "in" | "instanceof". */
	binaryExpression? ( op : string, left : any, right : any, loc? : SourceLocation );
	/* op can be "=" | "+=" | "-=" | "*=" | "/=" |
	 * "%=" | "<<=" | ">>=" | ">>>=" | "|=" | "^=" | "&=". */
	assignmentExpression? ( op : string, left : any, right : any, loc? : SourceLocation );
	// op can be "||" | "&&".
	logicalExpression? ( op : string, left : any, right : any, loc? : SourceLocation );
	// op can be "++" | "--".
	updateExpression? ( op : string, arg : any, isPrefix : bool, loc? : SourceLocation );
	newExpression? ( callee : any, args : any [], loc? : SourceLocation );
	callExpression? ( callee : any, args : any [], loc? : SourceLocation );
	memberExpression? ( obj : any, prop : any, isComputed : bool, loc? : SourceLocation );
	// name can be null.
	functionExpression? ( id : any, args : any [], body : any, isGenerator : bool, isExpression : bool, loc? : SourceLocation );
	// Any of elts can be null.
	arrayExpression? ( elts : any [], loc? : SourceLocation );
	objectExpression? ( props : any [], loc? : SourceLocation );
	thisExpression? ( loc? : SourceLocation );
	// Note: graphExpression and graphIndexExpression are obsolete.
	// filter can be null.
	comprehensionExpression? ( body : any, blocks : any [], filter : any, loc? : SourceLocation );
	// filter can be null.
	generatorExpression? ( body : any, blocks : any [], filter : any, loc? : SourceLocation );
	yieldExpression? ( arg : any, loc? : SourceLocation );
	letExpression? ( head : any [], body : any, loc? : SourceLocation );

	// Patterns:
	// any of elts can be null.
	arrayPattern? ( elts : any [], loc? : SourceLocation );
	objectPattern? ( props : any [], loc? : SourceLocation );
	propertyPattern? ( key : any, value : any, loc? : SourceLocation );

	// Clauses:
	// test can be null. The test argument is null if and only if the node is a default clause.
	switchCase? ( test : any, cons : any [], loc? : SourceLocation );
	catchClause? ( arg : any, guard : any, body : any, loc? : SourceLocation );
	comprehensionBlock? ( left : any, right : any, isForEach : bool, loc? : SourceLocation );

	// Miscellaneous:
	identifier? ( name : string, loc? : SourceLocation );
	// val can be of type string | boolean | null | number | RegExp.
	literal? ( val : any, loc? : SourceLocation );
	// kind can be "init" | "get" | "set".
	property? ( kind : string, key : any, val : any, loc? : SourceLocation );
}