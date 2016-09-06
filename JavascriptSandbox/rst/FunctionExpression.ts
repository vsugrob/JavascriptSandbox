/// <reference path="FunctionNode.ts" />

class FunctionExpression extends FunctionNode {
	public static get type () { return	'FunctionExpression'; }
	public precedence = 19;
	
	constructor (
		id : Identifier,
		params : Identifier [] = [],
		body = new BlockStatement ( [] ),
		loc? : SourceLocation
	) {
		super ( id, params, body, loc );
	}

	public onStep ( runtime : Runtime ) {
		if ( !runtime.regs [this.rIsExecuting] ) {
			var funcInstance = this.createInstance ( runtime );
			runtime.regs [this.rResult] = funcInstance;
			runtime.regs [this.rNodeState] = RstNodeState.Finished;
		} else
			super.onStep ( runtime );
	}

	public toCode () {
		return	this.generateCreateFunctionCode ();
	}
}