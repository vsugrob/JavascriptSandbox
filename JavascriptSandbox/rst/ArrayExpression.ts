/// <reference path="RstNode.ts" />

class ArrayExpression extends RstNode {
	public static get type () { return	'ArrayExpression'; }
	public elements : RstNode [];
	private rElementIdx : number;

	constructor ( elements : RstNode [] = [], loc? : SourceLocation ) {
		super ( loc );
		this.rElementIdx = RstNode.maxRegisterId++;
		this.linkChildren ( elements, 'elements' );
	}

	public visitDepthFirst ( callback : VisitorCallback ) {
		callback ( this );
		RstNode.visitNullableNodeArrayDepthFirst ( this.elements, callback );
	}

	public onEnter ( runtime : Runtime ) {
		runtime.regs [this.rElementIdx] = 0;
		runtime.regs [this.rResult] = Runtime.builtin.Array ( this.elements.length );
	}

	public onStep ( runtime : Runtime ) {
		var curIdx = runtime.regs [this.rElementIdx];

		if ( curIdx > 0 ) {
			var eltIdx = curIdx - 1,
				elementNode = this.elements [eltIdx];

			if ( elementNode !== null ) {
				var arr = runtime.regs [this.rResult],
					eltValue = runtime.regs [elementNode.rResult];

				Runtime.defineValue ( arr, eltIdx + '', eltValue, true, true, true );
			}
		}

		if ( runtime.regs [this.rElementIdx] >= this.elements.length )
			runtime.regs [this.rNodeState] = RstNodeState.Finished;
		else
			runtime.nextNode = this.elements [runtime.regs [this.rElementIdx]++];
	}

	public toCode () {
		var eCode = [];

		for ( var i = 0 ; i < this.elements.length ; i++ ) {
			var element = this.elements [i];
			Runtime.builtin.push.call ( eCode, element !== null ? element.toCode () : '' );
		}

		// Check whether last element should be followed by comma.
		var lastElided = this.elements.length > 0 &&
			this.elements [this.elements.length - 1] === null;
		
		return	'[' +
			Runtime.builtin.join.call ( eCode, ', ' ) +
			( lastElided ? ',' : '' ) +
			']';
	}
}