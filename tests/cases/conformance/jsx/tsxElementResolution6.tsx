//@filename: file.tsx
//@jsx: preserve
declare module JSX {
	interface Element { }
	interface IntrinsicElements { }
}

var div: any;
// OK
<div n='x' />;
