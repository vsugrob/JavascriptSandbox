/// <reference path="RstNode.ts" />

class Literal extends RstNode {
	public static get type () { return	'Literal'; }
	public isRegex : boolean;
	private regexPattern : string;
	private regexFlags : string;

	constructor ( public value : any, loc? : SourceLocation ) {
		super ( loc );

		this.isRegex = Runtime.builtin.ObjectToString.call ( this.value ) === '[object RegExp]';

		if ( this.isRegex ) {
			var regex = <RegExp> this.value;
			this.regexPattern = regex.source;
			this.regexFlags = '';

			if ( regex.global ) this.regexFlags += 'g';
			if ( regex.ignoreCase ) this.regexFlags += 'i';
			if ( regex.multiline ) this.regexFlags += 'm';
		}
	}

	public onStep ( runtime : Runtime ) {
		var value : any;
		
		if ( this.isRegex )
			value = new RegExp ( this.regexPattern, this.regexFlags );
		else
			value = this.value;

		runtime.regs [this.rResult] = value;
		runtime.regs [this.rNodeState] = RstNodeState.Finished;
	}

	public static quote ( v : string ) {
		var s = '';

		for ( var i = 0, len = v.length ; i < len ; i++ ) {
			var c = v [i];

			switch ( c ) {
			case '\\': s += '\\\\'; break;
			case '\n': s += '\\n'; break;
			case '\r': s += '\\r'; break;
			case '\u2028': s += '\\u2028'; break;	// LINE SEPARATOR
			case '\u2029': s += '\\u2029'; break;	// PARAGRAPH SEPARATOR
			case "'": s += "\\'"; break;
			default: s += c;
			}
		}

		return	"'" + s + "'";
	}

	public toQuotedString () {
		return	Literal.quote ( this.value + '' );
	}

	public toCode () {
		if ( typeof this.value === 'string' )
			return	Literal.quote ( this.value );
		else
			return	this.value + '';
	}
}