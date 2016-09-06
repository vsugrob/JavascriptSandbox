/// <reference path="../mozilla/AstBuilder.ts" />
'use strict';

class DefaultAstBuilder implements AstBuilder {
	// Programs:
	public program ( body : any [], loc? : SourceLocation ) {
		return	{
			type : 'Program',
			body : body,
			loc : loc || null
		};
	}

	// Statements:
	public emptyStatement ( loc? : SourceLocation ) {
		return	{
			type : 'EmptyStatement',
			loc : loc || null
		};
	}

	public blockStatement ( body : any [], loc? : SourceLocation ) {
		return	{
			type : 'BlockStatement',
			body : body,
			loc : loc || null
		}
	}

	public expressionStatement ( expr : any, loc? : SourceLocation ) {
		return	{
			type : 'ExpressionStatement',
			expression : expr,
			loc : loc || null
		};
	}

	public labeledStatement ( label : any, body : any, loc? : SourceLocation ) {
		return	{
			type : 'LabeledStatement',
			label : label,
			body : body,
			loc : loc || null
		};
	}
	
	public ifStatement ( test : any, cons : any, alt : any, loc? : SourceLocation ) {
		return	{
			type : 'IfStatement',
			test : test,
			consequent : cons,
			alternate : alt,
			loc : loc || null
		};
	}

	public switchStatement ( disc : any, cases : any [], isLexical : bool, loc? : SourceLocation ) {
		return	{
			type: 'SwitchStatement',
			discriminant : disc,
			cases : cases,
			lexical : isLexical,
			loc : loc || null
		};
	}

	public whileStatement ( test : any, body : any, loc? : SourceLocation ) {
		return	{
			type : 'WhileStatement',
			test : test,
			body : body,
			loc : loc || null
		};
	}

	public doWhileStatement ( body : any, test : any, loc? : SourceLocation ) {
		return	{
			type : 'DoWhileStatement',
			body : body,
			test : test,
			loc : loc || null
		};
	}

	public forStatement ( init : any, test : any, update : any, body : any, loc? : SourceLocation ) {
		return	{
			type : 'ForStatement',
			init : init,
			test : test,
			update : update,
			body : body,
			loc : loc || null
		};
	}

	public forInStatement ( left : any, right : any, body : any, isForEach : bool, loc? : SourceLocation ) {
		return	{
			type : 'ForInStatement',
			left : left,
			right : right,
			body : body,
			each : isForEach,
			loc : loc || null
		};
	}
	
	public breakStatement ( label : any, loc? : SourceLocation ) {
		return	{
			type : 'BreakStatement',
			label : label,
			loc : loc || null
		};
	}

	public continueStatement ( label : any, loc? : SourceLocation ) {
		return	{
			type : 'ContinueStatement',
			label : label,
			loc : loc || null
		};
	}

	public withStatement ( obj : any, body : any, loc? : SourceLocation ) {
		return	{
			type : 'WithStatement',
			object : obj,
			body : body,
			loc : loc || null
		};
	}

	public returnStatement ( arg : any, loc? : SourceLocation ) {
		return	{
			type : 'ReturnStatement',
			argument : arg,
			loc : loc || null
		};
	}

	public tryStatement ( body : any, handlers : any [], fin : any, loc? : SourceLocation ) {
		return	{
			type : 'TryStatement',
			block : body,
			handlers : handlers,
			guardedHandlers : [],	// Unused field, Mozilla-specific.
			finalizer : fin,
			loc : loc || null
		};
	}

	public throwStatement ( arg : any, loc? : SourceLocation ) {
		return	{
			type : 'ThrowStatement',
			argument : arg,
			loc : loc || null
		};
	}

	public debuggerStatement ( loc? : SourceLocation ) {
		return	{
			type : 'DebuggerStatement',
			loc : loc || null
		};
	}

	public letStatement ( head : any [], body : any, loc? : SourceLocation ) {
		return	{
			type : 'LetStatement',
			head : head,
			body : body,
			loc : loc || null
		};
	}

	// Declarations:
	public functionDeclaration (
		id : any, args : any [],
		body : any,
		isGenerator : bool, isExpression : bool,
		loc? : SourceLocation )
	{
		return	{
			type : 'FunctionDeclaration',
			id : id,
			params : args,
			defaults : [],	// Currently unused.
			rest : null,	// Currently unused.
			body : body,
			generator :isGenerator,
			expression : isExpression,
			loc : loc || null
		};
	}
	
	public variableDeclaration ( kind : string, dtors : any [], loc? : SourceLocation ) {
		return	{
			type : 'VariableDeclaration',
			declarations : dtors,
			kind : kind,
			loc : loc || null
		};
	}
	
	public variableDeclarator ( id : any, init : any, loc? : SourceLocation ) {
		return	{
			type : 'VariableDeclarator',
			id : id,
			init : init,
			loc : loc || null
		};
	}

	// Expressions:
	public sequenceExpression ( exprs : any [], loc? : SourceLocation ) {
		return	{
			type : 'SequenceExpression',
			expressions : exprs,
			loc : loc || null
		};
	}
	
	public conditionalExpression ( test : any, cons : any, alt : any, loc? : SourceLocation ) {
		return	{
			type : 'ConditionalExpression',
			test : test,
			consequent : cons,
			alternate : alt,
			loc : loc || null
		};
	}
	
	public unaryExpression ( op : string, arg : any, isPrefix : bool, loc? : SourceLocation ) {
		return	{
			type : 'UnaryExpression',
			operator : op,
			prefix : isPrefix,
			argument : arg,
			loc : loc || null
		};
	}

	public binaryExpression ( op : string, left : any, right : any, loc? : SourceLocation ) {
		return	{
			type : 'BinaryExpression',
			operator : op,
			left : left,
			right : right,
			loc : loc || null
		};
	}

	public assignmentExpression ( op : string, left : any, right : any, loc? : SourceLocation ) {
		return	{
			type : 'AssignmentExpression',
			operator : op,
			left : left,
			right : right,
			loc : loc || null
		};
	}

	public logicalExpression ( op : string, left : any, right : any, loc? : SourceLocation ) {
		return	{
			type : 'LogicalExpression',
			operator : op,
			left : left,
			right : right,
			loc : loc || null
		};
	}

	public updateExpression ( op : string, arg : any, isPrefix : bool, loc? : SourceLocation ) {
		return	{
			type : 'UpdateExpression',
			operator : op,
			argument : arg,
			prefix : isPrefix,
			loc : loc || null
		};
	}

	public newExpression ( callee : any, args : any [], loc? : SourceLocation ) {
		return	{
			type : 'NewExpression',
			callee : callee,
			arguments : args,
			loc : loc || null
		};
	}

	public callExpression ( callee : any, args : any [], loc? : SourceLocation ) {
		return	{
			type : 'CallExpression',
			callee : callee,
			arguments : args,
			loc : loc || null
		};
	}

	public memberExpression ( obj : any, prop : any, isComputed : bool, loc? : SourceLocation ) {
		return	{
			type : 'MemberExpression',
			object : obj,
			property : prop,
			computed : isComputed,
			loc : loc || null
		};
	}
	
	public functionExpression (
		id : any, args : any [],
		body : any,
		isGenerator : bool, isExpression : bool,
		loc? : SourceLocation )
	{
		return	{
			type : 'FunctionExpression',
			id : id,
			params : args,
			defaults : [],	// Currently unused.
			rest : null,	// Currently unused.
			body : body,
			generator : isGenerator,
			expression : isExpression,
			loc : loc || null
		};
	}
	
	public arrayExpression ( elts : any [], loc? : SourceLocation ) {
		return	{
			type : 'ArrayExpression',
			elements : elts,
			loc : loc || null
		};
	}

	public objectExpression ( props : any [], loc? : SourceLocation ) {
		return	{
			type : 'ObjectExpression',
			properties : props,
			loc : loc || null
		};
	}

	public thisExpression ( loc? : SourceLocation ) {
		return	{
			type : 'ThisExpression',
			loc : loc || null
		};
	}

	public comprehensionExpression ( body : any, blocks : any [], filter : any, loc? : SourceLocation ) {
		return	{
			type : 'ComprehensionExpression',
			body : body,
			blocks : blocks,
			filter : filter,
			loc : loc || null
		};
	}

	public generatorExpression ( body : any, blocks : any [], filter : any, loc? : SourceLocation ) {
		return	{
			type : 'GeneratorExpression',
			body : body,
			blocks : blocks,
			filter : filter,
			loc : loc || null
		};
	}

	public yieldExpression ( arg : any, loc? : SourceLocation ) {
		return	{
			type : 'YieldExpression',
			argument : arg,
			loc : loc || null
		};
	}

	public letExpression ( head : any [], body : any, loc? : SourceLocation ) {
		return	{
			type : 'LetExpression',
			head : head,
			body : body,
			loc : loc || null
		};
	}

	// Patterns:
	public arrayPattern ( elts : any [], loc? : SourceLocation ) {
		return	{
			type : 'ArrayPattern',
			elements : elts,
			loc : loc || null
		};
	}
	
	public objectPattern ( props : any [], loc? : SourceLocation ) {
		return	{
			type : 'ObjectPattern',
			properties : props,
			loc : loc || null
		};
	}

	public propertyPattern ( key : any, value : any, loc? : SourceLocation ) {
		return	{
			type : 'PropertyPattern',
			key : key,
			value : value,
			loc : loc || null
		};
	}

	// Clauses:
	public switchCase ( test : any, cons : any [], loc? : SourceLocation ) {
		return	{
			type : 'SwitchCase',
			test : test,
			consequent : cons,
			loc : loc || null
		};
	}

	public catchClause ( arg : any, guard : any, body : any, loc? : SourceLocation ) {
		return	{
			type : 'CatchClause',
			param : arg,
			guard : guard,	// Unused, Mozilla-specific.
			body : body,
			loc : loc || null
		};
	}
	
	public comprehensionBlock ( left : any, right : any, isForEach : bool, loc? : SourceLocation ) {
		return	{
			type : 'ComprehensionBlock',
			left : left,
			right : right,
			each : isForEach,
			loc : loc || null
		};
	}

	// Miscellaneous:
	public identifier ( name : string, loc? : SourceLocation ) {
		return	{
			type : 'Identifier',
			name : name,
			loc : loc || null
		};
	}

	public literal ( val : any, loc? : SourceLocation ) {
		return	{
			type : 'Literal',
			value : val,
			loc : loc || null
		};
	}
	
	public property ( kind : string, key : any, val : any, loc? : SourceLocation ) {
		return	{
			type : 'Property',
			key : key,
			value : val,
			kind : kind,
			loc : loc || null
		};
	}
}

System.breakPrototypeChain ( DefaultAstBuilder );