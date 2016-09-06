/// <reference path="InvocationNode.ts" />

class NewExpression extends InvocationNode {
	public static get type () { return	'NewExpression'; }
	public precedence = 1;
	
	private rConstructedObject : number;

	constructor ( callee : RstNode, args : RstNode [] = [], loc? : SourceLocation ) {
		super ( callee, args, loc );
		this.rConstructedObject = RstNode.maxRegisterId++;
	}

	public onStep ( runtime : Runtime ) {
		if ( runtime.regs [this.rState] === InvocationNodeState.PrepareInvocation ) {
			var funcInstance = <Function> runtime.regs [this.callee.rResult];
			InvocationNode.verifyCalleeFunction ( funcInstance );

			runtime.regs [this.rInvocationData] = {
				funcInstance : funcInstance,
				thisObj : undefined,
				args : null
			};
			runtime.regs [this.rState] = InvocationNodeState.MakeInvocation;
		} else if ( runtime.regs [this.rState] === InvocationNodeState.GetResult ) {
			var res = NewExpression.chooseConstructedObject (
				runtime.regs [this.rResult],
				runtime.regs [this.rConstructedObject]
			);

			runtime.regs [this.rResult] = res;
			runtime.regs [this.rNodeState] = RstNodeState.Finished;
		} else
			super.onStep ( runtime );
	}

	public static chooseConstructedObject ( funcRetValue : any, constructedObject : any ) {
		var typeofRetValue = typeof funcRetValue;

		if ( typeofRetValue === 'function' ||
			( typeofRetValue === 'object' && funcRetValue !== null ) )
		{
			return	funcRetValue;
		} else
			return	constructedObject;
	}

	public instantiate ( runtime : Runtime, funcInstance : Function ) {
		var proto = funcInstance.prototype,
			typeOfProto = typeof funcInstance.prototype;

		if ( typeOfProto !== 'object' && typeOfProto !== 'function' )
			proto = Runtime.builtin.ObjectPrototype;
		
		var instance = Runtime.builtin.create ( proto );
		runtime.regs [this.rConstructedObject] = instance;

		return	instance;
	}

	public static constructObject ( funcInstance : any, args : any [] ) {
		switch ( args.length ) {
			case 0: return	new funcInstance ();
			case 1: return	new funcInstance ( args [0] );
			case 2: return	new funcInstance ( args [0], args [1] );
			case 3: return	new funcInstance ( args [0], args [1], args [2] );
			case 4: return	new funcInstance ( args [0], args [1], args [2], args [3] );
			case 5: return	new funcInstance ( args [0], args [1], args [2], args [3], args [4] );
			case 6: return	new funcInstance ( args [0], args [1], args [2], args [3], args [4], args [5] );
			case 7: return	new funcInstance ( args [0], args [1], args [2], args [3], args [4], args [5], args [6] );
			case 8: return	new funcInstance ( args [0], args [1], args [2], args [3], args [4], args [5], args [6], args [7] );
			default:
				var boundCtor = Runtime.builtin.bind.apply ( funcInstance, [null].concat ( args ) );
				
				return	new boundCtor ();
			}
	}

	public toCode () {
		/* Note forced callee embracement. It's most likely that result
		 * of the callee.toCode () is a code representing function call
		 * like rt.getVar ( 'varName' ), so it definitely needs to be embraced. */
		var code = 'new ( ' + this.callee.toCode () + ' )' +
			' (' + this.generateArgumentListCode () + ')';

		return	code;
	}
}