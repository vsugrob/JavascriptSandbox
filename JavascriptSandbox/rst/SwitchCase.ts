/// <reference path="RstNode.ts" />

class SwitchCase extends RstNode {
	public static get type () { return	'SwitchCase'; }
	public test : RstNode;
	public consequent : RstNode [];
	private rStatementIdx : number;

	constructor ( test : RstNode, consequent : RstNode [] = [], loc? : SourceLocation ) {
		super ( loc );
		this.rStatementIdx = RstNode.maxRegisterId++;
		this.linkChild ( test, 'test' );
		this.linkChildren ( consequent, 'consequent' );
	}

	public onTreeCompleted () {
		if ( this.test !== null )
			this.test.parent = this.parent;
	}

	public visitDepthFirst ( callback : VisitorCallback ) {
		callback ( this );

		if ( this.test )
			this.test.visitDepthFirst ( callback );

		RstNode.visitNodeArrayDepthFirst ( this.consequent, callback );
	}

	public onEnter ( runtime : Runtime ) {
		runtime.regs [this.rStatementIdx] = 0;
	}

	public onStep ( runtime : Runtime ) {
		if ( runtime.regs [this.rStatementIdx] >= this.consequent.length ) {
			if ( this.consequent.length !== 0 ) {
				var lastStatement = this.consequent [this.consequent.length - 1];
				runtime.regs [this.rResult] = runtime.regs [lastStatement.rResult];
			}

			runtime.regs [this.rNodeState] = RstNodeState.Finished;
		} else
			runtime.nextNode = this.consequent [runtime.regs [this.rStatementIdx]++];
	}

	public toCode () {
		var code = '';

		if ( this.test !== null )
			code = 'case ' + this.test.toCode () + ':\n';
		else
			code = 'default:\n';

		for ( var i = 0 ; i < this.consequent.length ; i++ ) {
			var statement = this.consequent [i],
				sCode = statement.toCode ();

			if ( sCode )
				code += sCode + '\n';
		}

		return	code;
	}
}