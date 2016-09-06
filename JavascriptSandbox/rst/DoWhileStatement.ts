/// <reference path="RstNode.ts" />

enum DoWhileStatementState {
	EvalBody = undefined,
	EvalTest = 1,
	CheckTestResult = 2
}

class DoWhileStatement extends RstNode {
	public static get type () { return	'DoWhileStatement'; }
	public body : RstNode;
	public test : RstNode;

	private rState : number;

	constructor ( body : RstNode, test : RstNode, loc? : SourceLocation ) {
		super ( loc );
		this.rState = RstNode.maxRegisterId++;
		this.linkChild ( body, 'body' );
		this.linkChild ( test, 'test' );
	}

	public visitDepthFirst ( callback : VisitorCallback ) {
		callback ( this );
		this.body.visitDepthFirst ( callback );
		this.test.visitDepthFirst ( callback );
	}

	public onEnter ( runtime : Runtime ) {
		runtime.regs [this.rState] = DoWhileStatementState.EvalBody;
	}

	public onStep ( runtime : Runtime ) {
		if ( runtime.regs [this.rState] === DoWhileStatementState.EvalBody ) {
			runtime.nextNode = this.body;
			runtime.regs [this.rState] = DoWhileStatementState.EvalTest;
		} else if ( runtime.regs [this.rState] === DoWhileStatementState.EvalTest ) {
			runtime.nextNode = this.test;
			runtime.regs [this.rState] = DoWhileStatementState.CheckTestResult;
		} else if ( runtime.regs [this.rState] === DoWhileStatementState.CheckTestResult ) {
			var testValue = runtime.regs [this.test.rResult];

			if ( !testValue ) {
				var bodyValue = runtime.regs [this.body.rResult];
				runtime.regs [this.rResult] = bodyValue;
				runtime.regs [this.rNodeState] = RstNodeState.Finished;
			} else
				runtime.regs [this.rState] = DoWhileStatementState.EvalBody;
		}
	}

	public toCode () {
		return	'do ' +
			RstNode.encurly ( this.body ) +
			' while ( ' + this.test.toCode () + ' );';
	}
}