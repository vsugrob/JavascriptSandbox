/// <reference path="RstNode.ts" />

class BlockStatement extends RstNode {
	public static get type () { return	'BlockStatement'; }
	private rStatementIdx : number;
	public body : RstNode [] = [];

	constructor ( body : RstNode [] = [], loc? : SourceLocation ) {
		super ( loc );
		this.rStatementIdx = RstNode.maxRegisterId++;
		this.linkChildren ( body, 'body' );
	}

	public visitDepthFirst ( callback : VisitorCallback ) {
		callback ( this );
		RstNode.visitNodeArrayDepthFirst ( this.body, callback );
	}

	public onEnter ( runtime : Runtime ) {
		runtime.regs [this.rStatementIdx] = 0;
	}

	public onStep ( runtime : Runtime ) {
		if ( runtime.regs [this.rStatementIdx] >= this.body.length ) {
			if ( this.body.length !== 0 ) {
				var lastStatement = this.body [this.body.length - 1];
				runtime.regs [this.rResult] = runtime.regs [lastStatement.rResult];
			}

			runtime.regs [this.rNodeState] = RstNodeState.Finished;
		} else
			runtime.nextNode = this.body [runtime.regs [this.rStatementIdx]++];
	}

	public toCode () {
		var code = '{\n';

		for ( var i = 0 ; i < this.body.length ; i++ ) {
			var statement = this.body [i],
				sCode = statement.toCode ();

			if ( sCode )
				code += sCode + '\n';
		}

		code += '}';

		return	code;
	}
}