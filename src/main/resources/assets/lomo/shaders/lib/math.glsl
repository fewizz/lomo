/* lomo:lib/math.glsl */

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

vec3 pow3(vec3 v, float x) {
	return vec3(pow(v.x, x), pow(v.y, x), pow(v.z, x));
}

vec3 pow3(float x, vec3 p) {
	return vec3(pow(x, p.x), pow(x, p.y), pow(x, p.z));
}

// https://www.shadertoy.com/view/XlXcW4 , slightly modified
const uint k = 1103515245U;
vec2 hash22( uvec2 x ) {
	x = ((x>>8U)^x.yx)*k;
	x = ((x>>8U)^x.yx)*k;
	x = ((x>>8U)^x.yx)*k;
	
	return vec2(x)*(1.0/float(0xffffffffU));
}

mat3 rotation(float angle, vec3 v) {
	float a = angle;
	float c = cos(a);
	float s = sin(a);

	vec3 axis = vec3(normalize(v));
	vec3 temp = vec3((1. - c) * axis);

	mat3 r = mat3(0);
	r[0][0] = c + temp[0] * axis[0];
	r[0][1] = temp[0] * axis[1] + s * axis[2];
	r[0][2] = temp[0] * axis[2] - s * axis[1];

	r[1][0] = temp[1] * axis[0] - s * axis[2];
	r[1][1] = c + temp[1] * axis[1];
	r[1][2] = temp[1] * axis[2] + s * axis[0];

	r[2][0] = temp[2] * axis[0] + s * axis[1];
	r[2][1] = temp[2] * axis[1] - s * axis[0];
	r[2][2] = c + temp[2] * axis[2];

	return r;
}

vec3 random_vec(vec3 v, float coeff, uvec2 magic) {
	return v;
	/*
	// vec2 rand = hash22(magic);
	float a = exp(-coeff * 200. * hash22(magic)); // TODO
	rand *= 3.14 * (hash22(magic * 2u) * 2. - 1.);
	//rand *= 3.14;
	//rand *= a;

	return rotation(rand.y, vec3(0., 1., 0.)) * rotation(rand.x, vec3(1., 0., 0.)) * v;

	//float a0 = rand.x * v.y + cosa;
	//float xz_angle = atan(v.x, v.y);
	//float new_angle = xz_angle + rand.x*a;

	//float x = sin(new_angle);
	//float y = cos(new_angle);

	//float z = sqrt(1. - x*x - y*y) * sign(v.z);

	//return vec3(x, y, z);*/
}