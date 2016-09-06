/// <reference path="RstNode.ts" />

class BreakStatement extends RstNode {
	public static get type () { return	'BreakStatement'; }
	public label : Identifier = null;
	private jumpTarget : RstNode = null;

	constructor ( label : Identifier = null, loc? : SourceLocation ) {
		super ( loc );
		this.linkChild ( label, 'label' );
	}

	public onTreeCompleted () {
		// Seek for jump target.
		var node = this.parent;

		if ( this.label === null ) {
			// TODO: passing through FunctionNode is illegal.
			while ( node !== null && !node.isIterationStatement && node.type !== SwitchStatement.type ) {
				node = node.parent;
			}

			if ( node === null )
				throw new Runtime.builtin.SyntaxError ( 'Illegal break statement' );
		} else {
			var targetLabelName = this.label.name;
			// TODO: passing through FunctionNode is illegal.
			while ( node !== null ) {
				if ( node.type === LabeledStatement.type ) {
					var labelNode = <LabeledStatement> node;

					if ( labelNode.label.name === targetLabelName )
						break;
				}

				node = node.parent;
			}

			if ( node === null )
				throw new Runtime.builtin.SyntaxError ( 'Undefined label "' + targetLabelName + '"' );
		}

		this.jumpTarget = node.parent;
	}

	public visitDepthFirst ( callback : VisitorCallback ) {
		callback ( this );

		if ( this.label )
			this.label.visitDepthFirst ( callback );
	}

	public onStep ( runtime : Runtime ) {
		runtime.lift ( this.jumpTarget );
	}

	public toCode () {
		return	'break' + ( this.label !== null ? ' ' + this.label.name : '' ) + ';';
	}
}