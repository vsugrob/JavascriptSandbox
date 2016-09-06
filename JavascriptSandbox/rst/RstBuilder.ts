/// <reference path="../syntax/mozilla/AstBuilder.ts" />
/// <reference path="RstNode.ts" />
/// <reference path="../Runtime.ts" />
'use strict';

class RstBuilder implements AstBuilder {
	constructor ( public isStrict = false, public name? : string ) {}

	// Programs:
	public program ( body : any [], loc? : SourceLocation ) {
		var programNode = new Program ( body, loc, this.isStrict, this.name );

		programNode.visitDepthFirst ( function ( node : RstNode ) {
			node.onTreeCompleted ();
		} );

		return	programNode;
	}

	// Statements:
	public emptyStatement ( loc? : SourceLocation ) {
		return	new	EmptyStatement ( loc );
	}

	public blockStatement ( body : any [], loc? : SourceLocation ) {
		return	new BlockStatement ( body, loc );
	}

	public expressionStatement ( expr : any, loc? : SourceLocation ) {
		return	new ExpressionStatement ( expr, loc );
	}

	public labeledStatement ( label : any, body : any, loc? : SourceLocation ) {
		return	new LabeledStatement ( label, body, loc );
	}
	
	public ifStatement ( test : any, cons : any, alt : any, loc? : SourceLocation ) {
		return	new IfStatement ( test, cons, alt, loc );
	}

	public switchStatement ( disc : any, cases : any [], isLexical : boolean, loc? : SourceLocation ) {
		return	new SwitchStatement ( disc, cases, isLexical, loc );
	}

	public whileStatement ( test : any, body : any, loc? : SourceLocation ) {
		return	new WhileStatement ( test, body, loc );
	}

	public doWhileStatement ( body : any, test : any, loc? : SourceLocation ) {
		return	new DoWhileStatement ( body, test, loc );
	}

	public forStatement ( init : any, test : any, update : any, body : any, loc? : SourceLocation ) {
		return	new ForStatement ( init, test, update, body, loc );
	}

	public forInStatement ( left : any, right : any, body : any, isForEach : boolean, loc? : SourceLocation ) {
		return	new ForInStatement ( left, right, body, isForEach, loc );
	}
	
	public breakStatement ( label : any, loc? : SourceLocation ) {
		return	new BreakStatement ( label, loc );
	}

	public continueStatement ( label : any, loc? : SourceLocation ) {
		return	new ContinueStatement ( label, loc );
	}

	public withStatement ( obj : any, body : any, loc? : SourceLocation ) {
		return	new WithStatement ( obj, body, loc );
	}

	public returnStatement ( arg : any, loc? : SourceLocation ) {
		return	new ReturnStatement ( arg, loc );
	}

	public tryStatement ( body : any, handlers : any [], fin : any, loc? : SourceLocation ) {
		return	new TryStatement ( body, handlers, fin, loc );
	}

	public throwStatement ( arg : any, loc? : SourceLocation ) {
		return	new ThrowStatement ( arg, loc );
	}

	public debuggerStatement ( loc? : SourceLocation ) {
		// TODO: implement.
		//return	new DebuggerStatement ( loc );
	}

	public letStatement ( head : any [], body : any, loc? : SourceLocation ) {
		// TODO: implement.
		//return	new LetStatement ( head, body, loc );
	}

	// Declarations:
	public functionDeclaration (
		id : any, args : any [],
		body : any,
		isGenerator : boolean, isExpression : boolean,
		loc? : SourceLocation )
	{
		return	new FunctionDeclaration ( id, args, body, loc );
	}
	
	public variableDeclaration ( kind : string, dtors : any [], loc? : SourceLocation ) {
		return	new VariableDeclaration ( kind, dtors, loc );
	}
	
	public variableDeclarator ( id : any, init : any, loc? : SourceLocation ) {
		return	new VariableDeclarator ( id, init, loc );
	}

	// Expressions:
	public sequenceExpression ( exprs : any [], loc? : SourceLocation ) {
		return	new SequenceExpression ( exprs, loc );
	}
	
	public conditionalExpression ( test : any, cons : any, alt : any, loc? : SourceLocation ) {
		return	new ConditionalExpression ( test, cons, alt, loc );
	}
	
	public unaryExpression ( op : string, arg : any, isPrefix : boolean, loc? : SourceLocation ) {
		return	new UnaryExpression ( op, arg, loc );
	}

	public binaryExpression ( op : string, left : any, right : any, loc? : SourceLocation ) {
		return	new BinaryExpression ( op, left, right, loc );
	}

	public assignmentExpression ( op : string, left : any, right : any, loc? : SourceLocation ) {
		return	new AssignmentExpression ( op, left, right, loc );
	}

	public logicalExpression ( op : string, left : any, right : any, loc? : SourceLocation ) {
		return	new LogicalExpression ( op, left, right, loc  || null );
	}

	public updateExpression ( op : string, arg : any, isPrefix : boolean, loc? : SourceLocation ) {
		return	new UpdateExpression ( op, arg, isPrefix, loc );
	}

	public newExpression ( callee : any, args : any [], loc? : SourceLocation ) {
		return	new NewExpression ( callee, args, loc );
	}

	public callExpression ( callee : any, args : any [], loc? : SourceLocation ) {
		return	new CallExpression ( callee, args, loc );
	}

	public memberExpression ( obj : any, prop : any, isComputed : boolean, loc? : SourceLocation ) {
		return	new MemberExpression ( obj, prop, isComputed, loc );
	}
	
	public functionExpression (
		id : any, args : any [],
		body : any,
		isGenerator : boolean, isExpression : boolean,
		loc? : SourceLocation )
	{
		return	new FunctionExpression ( id, args, body, loc );
	}
	
	public arrayExpression ( elts : any [], loc? : SourceLocation ) {
		return	new ArrayExpression ( elts, loc );
	}

	public objectExpression ( props : any [], loc? : SourceLocation ) {
		return	new ObjectExpression ( props, loc );
	}

	public thisExpression ( loc? : SourceLocation ) {
		return	new ThisExpression ( loc );
	}

	public comprehensionExpression ( body : any, blocks : any [], filter : any, loc? : SourceLocation ) {
		// TODO: implement.
		//return	new ComprehensionExpression ( body, blocks, filter, loc );
	}

	public generatorExpression ( body : any, blocks : any [], filter : any, loc? : SourceLocation ) {
		// TODO: implement.
		//return	new GeneratorExpression ( body, blocks, filter, loc );
	}

	public yieldExpression ( arg : any, loc? : SourceLocation ) {
		// TODO: implement.
		//return	YieldExpression ( arg, loc );
	}

	public letExpression ( head : any [], body : any, loc? : SourceLocation ) {
		// TODO: implement.
		//return	new LetExpression ( head, body, loc );
	}

	// Patterns:
	public arrayPattern ( elts : any [], loc? : SourceLocation ) {
		// TODO: implement.
		//return	new ArrayPattern ( elts, loc );
	}
	
	public objectPattern ( props : any [], loc? : SourceLocation ) {
		// TODO: implement.
		//return	new ObjectPattern ( props, loc );
	}

	public propertyPattern ( key : any, value : any, loc? : SourceLocation ) {
		// TODO: implement.
		//return	new PropertyPattern ( key, value, loc );
	}

	// Clauses:
	public switchCase ( test : any, cons : any [], loc? : SourceLocation ) {
		return	new SwitchCase ( test, cons, loc );
	}

	public catchClause ( arg : any, guard : any, body : any, loc? : SourceLocation ) {
		return	new CatchClause ( arg, body, loc );
	}
	
	public comprehensionBlock ( left : any, right : any, isForEach : boolean, loc? : SourceLocation ) {
		// TODO: implement.
		//return	new ComprehensionBlock ( left, right, isForEach, loc );
	}

	// Miscellaneous:
	public identifier ( name : string, loc? : SourceLocation ) {
		return	new Identifier ( name, loc );
	}

	public literal ( val : any, loc? : SourceLocation ) {
		return	new Literal ( val, loc );
	}
	
	public property ( kind : string, key : any, val : any, loc? : SourceLocation ) {
		return	new Property ( kind, key, val, loc );
	}
}

System.breakPrototypeChain ( RstBuilder );