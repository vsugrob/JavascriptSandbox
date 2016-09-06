/// <reference path="IfStatement.ts" />

class ConditionalExpression extends IfStatement {
	public static get type () { return	'ConditionalExpression'; }
	public precedence = 15;

	constructor ( test : RstNode, consequent : RstNode, alternate : RstNode = null, loc? : SourceLocation ) {
		super ( test, consequent, alternate, loc );
	}

	public toCode () {
		return	this.embrace ( this.test ) + ' ? ' +
			this.embrace ( this.consequent ) + ' : ' +
			this.embrace ( this.alternate );
	}
}