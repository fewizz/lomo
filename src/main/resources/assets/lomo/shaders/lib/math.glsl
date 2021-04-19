float max4(float a, float b, float c, float d) {
	return max(max(a, b), max(c, d));
}

// z value for plane that goes through 0,0,0,
// with xy values known
float plane_z(
	vec3 d1, // vector with oiring 0,0,0, lies on plane
	vec3 d2, // second
	vec2 xy
) {
	return
	(xy.y*determinant(mat2(d1.xz, d2.xz)) - xy.x*determinant(mat2(d1.yz, d2.yz)))
	/
	determinant(mat2(d1.xy, d2.xy));
}

vec3 avoid_zero_components(vec3 v) {
	bool changed = false; // is this worth it?

	for(int a = 0; a < 3; a++) {
		if(v[a] == 0.0) {
			v[a] == 0.0001;
			changed = true;
		}
	}

	if(changed) v = normalize(v);

	return v;
}