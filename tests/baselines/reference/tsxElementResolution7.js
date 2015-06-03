//// [tsxElementResolution7.tsx]
declare module JSX {
	interface Element { }
}

module my {
    export var div: any;
}
// OK
<my.div n='x' />;
// Error
<my.other />;

module q {
    import mine = my;
    // OK
    <mine.div n='x' />;
    // Error
    <mine.non />;
}


//// [tsxElementResolution7.jsx]
var my;
(function (my) {
})(my || (my = {}));
// OK
<my.div n='x'/>;
// Error
<my.other />;
var q;
(function (q) {
    // OK
    <mine.div n='x'/>;
    // Error
    <mine.non />;
})(q || (q = {}));
