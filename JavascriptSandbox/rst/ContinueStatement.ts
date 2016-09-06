/// <reference path="RstNode.ts" />

class ContinueStatement extends RstNode {
	public static get type () { return	'ContinueStatement'; }
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
			while ( node !== null && !node.isIterationStatement ) {
				node = node.parent;
			}

			if ( node === null )
				throw new Runtime.builtin.SyntaxError ( 'Illegal continue statement' );
		} else {
			var targetLabelName = this.label.name,
				ancestors : RstNode [] = [];
			// TODO: passing through FunctionNode is illegal.
			while ( node !== null ) {
				Runtime.builtin.unshift.call ( ancestors, node );

				if ( node.type === LabeledStatement.type ) {
					var labelNode = <LabeledStatement> node;

					if ( labelNode.label.name === targetLabelName )
						break;
				}

				node = node.parent;
			}

			if ( node !== null ) {
				// Get through label nodes to the iteration statement.
				for ( var i = 1 ; i < ancestors.length ; i++ ) {
					var ancestor = ancestors [i];

					if ( ancestor.isIterationStatement ) {
						node = ancestor;
						break;
					} else if ( ancestor.type !== LabeledStatement.type ) {
						node = null;
						break;
					}
				}
			}

			if ( node === null )
				throw new Runtime.builtin.SyntaxError ( 'Undefined label "' + targetLabelName + '"' );
		}

		this.jumpTarget = node;
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
		return	'continue' + ( this.label !== null ? ' ' + this.label.name : '' ) + ';';
	}
}