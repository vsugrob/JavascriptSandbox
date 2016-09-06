/// <reference path="RstNode.ts" />

class ThisExpression extends RstNode {
	public static get type () { return	'ThisExpression'; }

	constructor ( loc? : SourceLocation ) {
		super ( loc );
	}

	public onStep ( runtime : Runtime ) {
		runtime.regs [this.rResult] = runtime.currentScope.thisObj;
		runtime.regs [this.rNodeState] = RstNodeState.Finished;
	}

	public toCode () {
		return	'this';
	}
}