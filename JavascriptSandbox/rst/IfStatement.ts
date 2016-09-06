/// <reference path="RstNode.ts" />

enum IfStatementState {
	EvalTest = undefined,
	EvalBranch = 1,
	GetResult = 2
}

enum IfBranch {
	None = undefined,
	Consequent = 1,
	Alternate = 2
}

class IfStatement extends RstNode {
	public static get type () { return	'IfStatement'; }
	public test : RstNode;
	public consequent : RstNode;
	public alternate : RstNode;

	private rState : number;
	private rEvaluatedBranch : number;

	constructor ( test : RstNode, consequent : RstNode, alternate : RstNode = null, loc? : SourceLocation ) {
		super ( loc );
		this.rState = RstNode.maxRegisterId++;
		this.rEvaluatedBranch = RstNode.maxRegisterId++;
		this.linkChild ( test, 'test' );
		this.linkChild ( consequent, 'consequent' );
		this.linkChild ( alternate, 'alternate' );
	}

	public visitDepthFirst ( callback : VisitorCallback ) {
		callback ( this );
		this.test.visitDepthFirst ( callback );
		this.consequent.visitDepthFirst ( callback );

		if ( this.alternate )
			this.alternate.visitDepthFirst ( callback );
	}

	public onEnter ( runtime : Runtime ) {
		runtime.regs [this.rState] = IfStatementState.EvalTest;
	}

	public onStep ( runtime : Runtime ) {
		if ( runtime.regs [this.rState] === IfStatementState.EvalTest ) {
			runtime.nextNode = this.test;
			runtime.regs [this.rState] = IfStatementState.EvalBranch;
		} else if ( runtime.regs [this.rState] === IfStatementState.EvalBranch ) {
			var testValue = runtime.regs [this.test.rResult];

			if ( testValue ) {
				runtime.nextNode = this.consequent;
				runtime.regs [this.rState] = IfStatementState.GetResult;
				runtime.regs [this.rEvaluatedBranch] = IfBranch.Consequent;
			} else {
				if ( this.alternate !== null ) {
					runtime.nextNode = this.alternate;
					runtime.regs [this.rState] = IfStatementState.GetResult;
					runtime.regs [this.rEvaluatedBranch] = IfBranch.Alternate;
				} else {
					runtime.regs [this.rResult] = undefined;
					runtime.regs [this.rEvaluatedBranch] = IfBranch.None;
					runtime.regs [this.rNodeState] = RstNodeState.Finished;
				}
			}
		} else if ( runtime.regs [this.rState] === IfStatementState.GetResult ) {
			var branch = runtime.regs [this.rEvaluatedBranch],
				branchNode = branch === IfBranch.Consequent ? this.consequent : this.alternate,
				branchValue = runtime.regs [branchNode.rResult];

			runtime.regs [this.rResult] = branchValue;
			runtime.regs [this.rNodeState] = RstNodeState.Finished;
		}
	}

	public toCode () {
		var code = 'if ( ' + this.test.toCode () + ' ) ' +
			RstNode.encurly ( this.consequent );

		if ( this.alternate !== null )
			code += ' else ' + RstNode.encurly ( this.alternate );

		return	code;
	}
}