/// <reference path="ArrayExpression.ts" />
/// <reference path="AssignmentExpression.ts" />
/// <reference path="BinaryExpression.ts" />
/// <reference path="BlockStatement.ts" />
/// <reference path="BreakStatement.ts" />
/// <reference path="CallExpression.ts" />
/// <reference path="CatchClause.ts" />
/// <reference path="ConditionalExpression.ts" />
/// <reference path="ContinueStatement.ts" />
/// <reference path="DoWhileStatement.ts" />
/// <reference path="EmptyStatement.ts" />
/// <reference path="ExpressionStatement.ts" />
/// <reference path="ForStatement.ts" />
/// <reference path="ForInStatement.ts" />
/// <reference path="FunctionDeclaration.ts" />
/// <reference path="FunctionExpression.ts" />
/// <reference path="Identifier.ts" />
/// <reference path="IfStatement.ts" />
/// <reference path="LabeledStatement.ts" />
/// <reference path="Literal.ts" />
/// <reference path="LogicalExpression.ts" />
/// <reference path="MemberExpression.ts" />
/// <reference path="NewExpression.ts" />
/// <reference path="ObjectExpression.ts" />
/// <reference path="Program.ts" />
/// <reference path="Property.ts" />
/// <reference path="ReturnStatement.ts" />
/// <reference path="SequenceExpression.ts" />
/// <reference path="SwitchCase.ts" />
/// <reference path="SwitchStatement.ts" />
/// <reference path="ThisExpression.ts" />
/// <reference path="ThrowStatement.ts" />
/// <reference path="TryStatement.ts" />
/// <reference path="UnaryExpression.ts" />
/// <reference path="UpdateExpression.ts" />
/// <reference path="VariableDeclaration.ts" />
/// <reference path="VariableDeclarator.ts" />
/// <reference path="WhileStatement.ts" />
/// <reference path="WithStatement.ts" />

/// <reference path="ScopeNode.ts" />
/// <reference path="../Runtime.ts" />

enum RstNodeState {
	NotInitialized = undefined,
	Initialized = 1,
	Working = 2,
	Finished = 3
}

interface VisitorCallback {
	( node : RstNode ) : void;
}

class RstNode {
	public static maxRegisterId = 0;
	public parent : RstNode = null;
	public parentProperty : string = null;
	public loc : SourceLocation;
	public get type () { return	<string> this ['constructor']['type']; }
	public precedence = null;	// Most of the nodes has no precedence.

	public get isAtLeftHandSide () {
		var parentType = this.parent.type;

		if ( parentType === AssignmentExpression.type || parentType === ForInStatement.type ) {
			if ( this.parentProperty === 'left' )
				return	true;
		} else if ( parentType === UpdateExpression.type )
			return	true;

		return	false;
	}

	public get isLeftHandSideExpression () {
		return	this.type === Identifier.type || this.type === MemberExpression.type;
	}

	// TODO: isStatement
	// TODO: isExpression
	public get isIterationStatement () {
		return	this.type === DoWhileStatement.type || this.type === WhileStatement.type ||
			this.type === ForStatement.type || this.type === ForInStatement.type;
	}

	public get parentScopeNode () {
		var node = this.parent;

		while ( node !== null && !( node instanceof ScopeNode ) ) {
			node = node.parent;
		}

		return	<ScopeNode> node;
	}

	public get programNode () {
		var node = <RstNode> this;

		while ( node !== null && !( node instanceof Program ) ) {
			node = node.parent;
		}

		return	<Program> node;
	}

	public get scopeFullName () {
		var node = this.parent,
			fullName = '';

		while ( node !== null ) {
			if ( node instanceof ScopeNode ) {
				var scopeNode = <ScopeNode> node;
				fullName = scopeNode.name + '.' + fullName;
			}

			node = node.parent;
		}

		fullName = Runtime.builtin.substr.call ( fullName, 0, fullName.length - 1 );

		return	fullName;
	}
	
	public rNodeState : number;
	public rResult : number;
	
	constructor ( loc? : SourceLocation ) {
		this.rNodeState = RstNode.maxRegisterId++;
		this.rResult = RstNode.maxRegisterId++;
		this.loc = loc || null;
	}

	public /*virtual*/ visitDepthFirst ( callback : VisitorCallback ) {
		callback ( this );
	}

	public static visitNodeArrayDepthFirst ( nodes : RstNode [], callback : VisitorCallback ) {
		for ( var i = 0 ; i < nodes.length ; i++ ) {
			var node = nodes [i];
			node.visitDepthFirst ( callback );
		}
	}

	public static visitNullableNodeArrayDepthFirst ( nodes : RstNode [], callback : VisitorCallback ) {
		for ( var i = 0 ; i < nodes.length ; i++ ) {
			var node = nodes [i];

			if ( node )
				node.visitDepthFirst ( callback );
		}
	}

	public linkChild ( node : RstNode, property : string ) {
		if ( node == null ) {
			this [property] = null;

			return;
		} else
			this [property] = node;

		node.parent = this;
		node.parentProperty = property;
		node.onAddedToTree ();
	}

	public linkChildren ( nodes : RstNode [], property : string ) {
		this [property] = nodes;

		for ( var i = 0 ; i < nodes.length ; i++ ) {
			var node = nodes [i];

			if ( node ) {
				node.parent = this;
				node.parentProperty = property;
				node.onAddedToTree ();
			}
		}
	}

	public /*virtual*/ onAddedToTree () {}
	public /*virtual*/ onTreeCompleted () {}

	public step ( runtime : Runtime ) {
		if ( runtime.regs [this.rNodeState] === RstNodeState.NotInitialized ) {
			this.onEnter ( runtime );
			runtime.regs [this.rNodeState] = RstNodeState.Initialized;
		}

		this.onStep ( runtime );
	}

	public onEnter ( runtime : Runtime ) {}

	public onStep ( runtime : Runtime ) {
		runtime.regs [this.rNodeState] = RstNodeState.Finished;
	}

	// TODO: throw?
	public toCode () { return	''; }

	// TODO: Move to MemberExpression. Make it look like MemberExpression.setPurpose ( ... ).
	public static setMemberExpressionPurpose (
		runtime : Runtime,
		node : RstNode,
		purpose : MemberExpressionPurpose )
	{
		if ( node !== null && node.type === MemberExpression.type ) {
			var memberExpr = <MemberExpression> node;
			runtime.regs [memberExpr.rPurpose] = purpose;

			return	true;
		} else
			return	false;
	}

	public embrace ( node : RstNode ) {
		if ( node.precedence === null || this.precedence >= node.precedence )
			return	node.toCode ();
		else
			return	'( ' + node.toCode () + ' )';
	}

	// TODO: make static? or operate on 'this' instead of 'node'?
	public embraceSequence ( node : RstNode ) {
		if ( node.type === SequenceExpression.type )
			return	'( ' + node.toCode () + ' )';
		else
			return	node.toCode ();
	}

	/* Encloses code generated by node.toCode () with curly braces
	 * when node is not of BlockStatement type. */
	public static encurly ( node : RstNode ) {
		if ( node.type !== BlockStatement.type )
			return	'{\n' + node.toCode () + '\n}';
		else
			return	node.toCode ();
	}
}

System.breakPrototypeChain ( RstNode );