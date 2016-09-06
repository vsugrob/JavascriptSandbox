/// <reference path="RstNode.ts" />

enum SwitchStatementState {
	EvalDiscriminant = undefined,
	GetDiscriminantResult = 1,
	EvalNextTest = 2,
	CheckTestValue = 3,
	EvalConsequents = 4
}

class SwitchStatement extends RstNode {
	public static get type () { return	'SwitchStatement'; }
	public discriminant : RstNode;
	public cases : SwitchCase [];
	public defaultCaseIdx = -1;

	private rState : number;
	private rDiscriminantResult : number;
	private rCaseIdx : number;

	// TODO: implement isLexical.
	constructor ( discriminant : RstNode, cases : SwitchCase [] = [], public isLexical = false, loc? : SourceLocation ) {
		super ( loc );
		this.rState = RstNode.maxRegisterId++;
		this.rDiscriminantResult = RstNode.maxRegisterId++;
		this.rCaseIdx = RstNode.maxRegisterId++;
		this.linkChild ( discriminant, 'discriminant' );
		this.linkChildren ( cases, 'cases' );

		for ( var i = 0 ; i < this.cases.length ; i++ ) {
			var caseNode = this.cases [i];

			if ( caseNode.test === null ) {
				this.defaultCaseIdx = i;

				break;
			}
		}
	}

	public visitDepthFirst ( callback : VisitorCallback ) {
		callback ( this );
		this.discriminant.visitDepthFirst ( callback );
		RstNode.visitNodeArrayDepthFirst ( this.cases, callback );
	}

	public onEnter ( runtime : Runtime ) {
		runtime.regs [this.rState] = SwitchStatementState.EvalDiscriminant;
		runtime.regs [this.rDiscriminantResult] = undefined;
		runtime.regs [this.rCaseIdx] = 0;
	}

	public onStep ( runtime : Runtime ) {
		if ( runtime.regs [this.rState] === SwitchStatementState.EvalDiscriminant ) {
			runtime.nextNode = this.discriminant;
			runtime.regs [this.rState] = SwitchStatementState.GetDiscriminantResult;
		} else if ( runtime.regs [this.rState] === SwitchStatementState.GetDiscriminantResult ) {
			runtime.regs [this.rDiscriminantResult] = runtime.regs [this.discriminant.rResult];

			if ( this.cases.length !== 0 )
				runtime.regs [this.rState] = SwitchStatementState.EvalNextTest;
			else {
				runtime.regs [this.rResult] = undefined;
				runtime.regs [this.rNodeState] = RstNodeState.Finished;
			}
		} else if ( runtime.regs [this.rState] === SwitchStatementState.EvalNextTest ) {
			var caseIdx = runtime.regs [this.rCaseIdx];

			if ( caseIdx >= this.cases.length ) {
				if ( this.defaultCaseIdx !== -1 ) {
					runtime.nextNode = this.cases [this.defaultCaseIdx];
					runtime.regs [this.rCaseIdx] = this.defaultCaseIdx + 1;
					runtime.regs [this.rState] = SwitchStatementState.EvalConsequents;
				} else {
					runtime.regs [this.rResult] = undefined;
					runtime.regs [this.rNodeState] = RstNodeState.Finished;
				}
			} else if ( caseIdx === this.defaultCaseIdx )
				runtime.regs [this.rCaseIdx]++; // Skip testing default case.
			else {
				runtime.nextNode = this.cases [caseIdx].test;
				runtime.regs [this.rState] = SwitchStatementState.CheckTestValue;
			}
		} else if ( runtime.regs [this.rState] === SwitchStatementState.CheckTestValue ) {
			var caseIdx = runtime.regs [this.rCaseIdx]++,
				testedCase = this.cases [caseIdx],
				testValue = runtime.regs [testedCase.test.rResult],
				discriminantValue = runtime.regs [this.rDiscriminantResult];

			if ( testValue === discriminantValue ) {
				runtime.nextNode = testedCase;
				runtime.regs [this.rState] = SwitchStatementState.EvalConsequents;
			} else
				runtime.regs [this.rState] = SwitchStatementState.EvalNextTest;
		} else if ( runtime.regs [this.rState] === SwitchStatementState.EvalConsequents ) {
			var caseIdx = runtime.regs [this.rCaseIdx]++;

			if ( caseIdx >= this.cases.length ) {
				/* TODO: set appropriate result.
				 * UPD: statements should not return results.
				 * Now we have Runtime.lr (meaning 'last result'). */
				runtime.regs [this.rResult] = undefined;
				runtime.regs [this.rNodeState] = RstNodeState.Finished;
			} else
				runtime.nextNode = this.cases [caseIdx];
		}
	}

	public toCode () {
		var code = 'switch ( ' + this.discriminant.toCode () + ' ) {\n';

		for ( var i = 0 ; i < this.cases.length ; i++ ) {
			var caseNode = this.cases [i];
			code += caseNode.toCode ();
		}

		code += '}';

		return	code;
	}
}