/// <reference path="RstNode.ts" />

enum WhileStatementState {
	EvalTest = undefined,
	EvalBody = 1
}

class WhileStatement extends RstNode {
	public static get type () { return	'WhileStatement'; }
	public test : RstNode;
	public body : RstNode;

	private rState : number;

	constructor ( test : RstNode, body : RstNode, loc? : SourceLocation ) {
		super ( loc );
		this.rState = RstNode.maxRegisterId++;
		this.linkChild ( test, 'test' );
		this.linkChild ( body, 'body' );
	}

	public visitDepthFirst ( callback : VisitorCallback ) {
		callback ( this );
		this.test.visitDepthFirst ( callback );
		this.body.visitDepthFirst ( callback );
	}

	public onEnter ( runtime : Runtime ) {
		runtime.regs [this.rState] = WhileStatementState.EvalTest;
	}

	public onStep ( runtime : Runtime ) {
		if ( runtime.regs [this.rState] === WhileStatementState.EvalTest ) {
			runtime.nextNode = this.test;
			runtime.regs [this.rState] = WhileStatementState.EvalBody;
		} else if ( runtime.regs [this.rState] === WhileStatementState.EvalBody ) {
			var testValue = runtime.regs [this.test.rResult];

			if ( !testValue ) {
				var bodyValue = runtime.regs [this.body.rResult];
				runtime.regs [this.rResult] = bodyValue;
				runtime.regs [this.rNodeState] = RstNodeState.Finished;
			} else {
				runtime.nextNode = this.body;
				runtime.regs [this.rState] = WhileStatementState.EvalTest;
			}
		}
	}

	public toCode () {
		return	'while ( ' + this.test.toCode () + ' ) ' +
			RstNode.encurly ( this.body );
	}
}