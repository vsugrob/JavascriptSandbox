interface ParsedIdentifier {
	type : string;
	name : string;
}

interface ParseIdentifiersResult {
	identifiers : ParsedIdentifier [];
	tailExprStart : number;
}

interface ReflectedType {
	classType : string;		// [[Class]] internal property value.
	specificType : string;
}

interface ReflectedProperty {
	parentValue : ReflectedValue;
	name : string;
	attributes : string;
	value : ReflectedValue;
}

interface ReflectedValue {
	parentProperty : ReflectedProperty;
	value : string;
	success : bool;
	hasCustomStringRepr : bool;
	type : ReflectedType;
	path : string [];
	hasProperties : bool;
	properties : ReflectedProperty [];
}

interface ReflectByTreeQueryNode {
	name : string;
	props : ReflectByTreeQueryNode [];
}

interface SandboxPacket {
	type : string;
	id : number;
	data : any;
}