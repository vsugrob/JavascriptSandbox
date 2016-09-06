/// <reference path="RstNode.ts" />

class Identifier extends RstNode {
	public static get type () { return	'Identifier'; }
	public isVariableRead = false;
	public behaveAsLiteral = false;

	public rScope : number;

	constructor ( public name : string, loc? : SourceLocation ) {
		super ( loc );
		this.rScope = RstNode.maxRegisterId++;
	}

	public onAddedToTree () {
		var parentType = this.parent.type;

		if ( parentType === AssignmentExpression.type ) {
			if ( this.parentProperty === 'right' )
				this.isVariableRead = true;
		} else if ( parentType === MemberExpression.type ) {
			var parentMemberExpr = <MemberExpression> this.parent;

			if ( this.parentProperty === 'object' || ( this.parentProperty === 'property' && parentMemberExpr.computed ) )
				this.isVariableRead = true;
			else if ( this.parentProperty === 'property' && !parentMemberExpr.computed )
				this.behaveAsLiteral = true;
		} else if ( parentType === ArrayExpression.type ||
					parentType === BinaryExpression.type ||
					parentType === CallExpression.type ||
					parentType === ConditionalExpression.type ||
					parentType === DoWhileStatement.type ||
					parentType === ExpressionStatement.type ||
					parentType === ForStatement.type ||
					parentType === IfStatement.type ||
					parentType === LogicalExpression.type ||
					parentType === NewExpression.type ||
					parentType === ReturnStatement.type ||
					parentType === SequenceExpression.type ||
					parentType === SwitchStatement.type ||
					parentType === SwitchCase.type ||
					parentType === ThrowStatement.type ||
					parentType === WhileStatement.type ||
					parentType === WithStatement.type )
		{
			this.isVariableRead = true;
		} else if ( parentType === ForInStatement.type ) {
			if ( this.parentProperty === 'right' )
				this.isVariableRead = true;
		} else if ( parentType === Property.type ) {
			if ( this.parentProperty === 'value' )
				this.isVariableRead = true;
			else if ( this.parentProperty === 'key' )
				this.behaveAsLiteral = true;
		} else if ( parentType === UnaryExpression.type ) {
			var parentUnaryExpr = <UnaryExpression> this.parent;

			if ( parentUnaryExpr.operator !== 'delete' &&
				 parentUnaryExpr.operator !== 'typeof' )
			{
				this.isVariableRead = true;
			} else
				this.behaveAsLiteral = true;
		} else if ( parentType === VariableDeclarator.type ) {
			if ( this.parentProperty === 'init' )
				this.isVariableRead = true;
		}
	}

	public onStep ( runtime : Runtime ) {
		var value : any = undefined;

		if ( this.isVariableRead )
			value = runtime.getVar ( this.name, this.rScope );
		else if ( this.behaveAsLiteral ) {
			value = this.name;
			runtime.regs [this.rScope] = undefined;
		}

		runtime.regs [this.rResult] = value;
		runtime.regs [this.rNodeState] = RstNodeState.Finished;
	}

	public toQuotedString () {
		return	Literal.quote ( this.name );
	}

	public toCode () {
		if ( this.isVariableRead )
			return	'rt.getVar ( "' + this.name + '" )';
		else
			return	this.toQuotedString ();
	}
}