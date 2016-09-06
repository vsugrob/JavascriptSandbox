/// <reference path="RstNode.ts" />

enum MemberExpressionState {
	EvalObject = undefined,
	EvalProperty = 1,
	GetValue = 2,
	OperationDone = 3
}

enum MemberExpressionPurpose {
	// O = eval o, P = eval p, PS = String ( P ), V = O [PS].
	EvalOPAndReadValue = undefined,
	// O = eval o, P = eval p.
	EvalOP = 1,
	// PS = String ( P ), V = O [PS].
	ReadValue = 2,
	// PS = String ( P ), O [PS] = V.
	WriteValue = 3
}

class MemberExpression extends RstNode {
	public static get type () { return	'MemberExpression'; }
	public object : RstNode;
	public property : RstNode;
	public isStrict = false;
	public precedence = 1;

	private rState : number;
	public rPurpose : number;	// Is to be set from outside.

	constructor ( object : RstNode, property : RstNode, public computed : bool, loc? : SourceLocation ) {
		super ( loc );
		this.rState = RstNode.maxRegisterId++;
		this.rPurpose = RstNode.maxRegisterId++;
		this.linkChild ( object, 'object' );
		this.linkChild ( property, 'property' );
	}

	public visitDepthFirst ( callback : VisitorCallback ) {
		callback ( this );
		this.object.visitDepthFirst ( callback );
		this.property.visitDepthFirst ( callback );
	}

	public onEnter ( runtime : Runtime ) {
		runtime.regs [this.rState] = MemberExpressionState.EvalObject;
		// Note: this.rPurpose is not initialized intentionally, it must be set from outside.
	}

	public onStep ( runtime : Runtime ) {
		if ( runtime.regs [this.rState] === MemberExpressionState.OperationDone ) {
			runtime.regs [this.rNodeState] = RstNodeState.Finished;
		} else {
			if ( runtime.regs [this.rPurpose] === MemberExpressionPurpose.EvalOPAndReadValue ||
				 runtime.regs [this.rPurpose] === MemberExpressionPurpose.EvalOP )
			{
				if ( runtime.regs [this.rState] === MemberExpressionState.EvalObject ) {
					runtime.nextNode = this.object;
					runtime.regs [this.rState] = MemberExpressionState.EvalProperty;
				} else if ( runtime.regs [this.rState] === MemberExpressionState.EvalProperty ) {
					runtime.nextNode = this.property;
					runtime.regs [this.rState] = MemberExpressionState.GetValue;
				} else if ( runtime.regs [this.rState] === MemberExpressionState.GetValue ) {
					if ( runtime.regs [this.rPurpose] === MemberExpressionPurpose.EvalOPAndReadValue ) {
						runtime.regs [this.rState] = MemberExpressionState.OperationDone;
						this.readValue ( runtime );
					} else {
						runtime.regs [this.rResult] = undefined;
						runtime.regs [this.rNodeState] = RstNodeState.Finished;
					}
				}
			} else if ( runtime.regs [this.rPurpose] === MemberExpressionPurpose.ReadValue ) {
				runtime.regs [this.rState] = MemberExpressionState.OperationDone;
				this.readValue ( runtime );
			} else /*if ( runtime.registers [this.rPurpose] === MemberExpressionPurpose.WriteValue )*/ {
				runtime.regs [this.rState] = MemberExpressionState.OperationDone;
				this.writeValue ( runtime );
			}
		}
	}

	private readValue ( runtime : Runtime ) {
		var o = runtime.regs [this.object.rResult],
			p = runtime.regs [this.property.rResult];
		
		runtime.readMember ( o, p, this );
	}

	private writeValue ( runtime : Runtime ) {
		var o = runtime.regs [this.object.rResult],
			p = runtime.regs [this.property.rResult],
			v = runtime.regs [this.rResult];

		runtime.writeMember ( o, p, v, this );
	}

	public toCode () {
		return	this.toCodeEvalOPAndReadMember ();
	}

	public toCodeEvalOP () {
		return	'( rt.regs [' + this.object.rResult + '] = ' +
			this.embraceSequence ( this.object ) + ', ' +
			'rt.regs [' + this.property.rResult + '] = ' +
			this.property.toCode () +
		' )';
	}

	public toCodeReadMember () {
		return	'rt.regs [' + this.rResult + '] = ' +
			'rt.readMember ( ' +
				'rt.regs [' + this.object.rResult + '], ' +
				'rt.regs [' + this.property.rResult + ']' +
			' )';
	}

	public toCodeEvalOPAndReadMember () {
		return	'( ' +
			this.toCodeEvalOP () + ', ' +
			this.toCodeReadMember () +
		' )';
	}

	public toCodeWriteMember ( valueToAssign : string );
	public toCodeWriteMember ( valueToAssign : RstNode );
	public toCodeWriteMember ( valueToAssign : any ) {
		var valueCode : string;

		if ( typeof valueToAssign === 'string' )
			valueCode = '( ' + valueToAssign + ' )';
		else
			valueCode = this.embraceSequence ( valueToAssign );

		return	'rt.writeMember ( ' +
			'rt.regs [' + this.object.rResult + '], ' +
			'rt.regs [' + this.property.rResult + '], ' +
			valueCode +
		' )';
	}

	public toCodeEvalOPAndWriteMember ( valueToAssign : string );
	public toCodeEvalOPAndWriteMember ( valueToAssign : RstNode );
	public toCodeEvalOPAndWriteMember ( valueToAssign : any ) {
		return	'( ' +
			this.toCodeEvalOP () + ', ' +
			this.toCodeWriteMember ( valueToAssign ) +
		' )';
	}
}