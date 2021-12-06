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

// https://www.shadertoy.com/view/4djSRW
vec2 hash23(vec3 p3) {
	p3 = fract(p3 * vec3(.1031, .1030, .0973));
	p3 += dot(p3, p3.yzx+33.33);
	return fract((p3.xx+p3.yz)*p3.zy);
}

vec2 hash22(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
	p3 += dot(p3, p3.yzx+33.33);
	return fract((p3.xx+p3.yz)*p3.zy);
}

float hash12(vec2 p) {
	vec3 p3  = fract(vec3(p.xyx) * .1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}


mat3 rotation(float angle, vec3 v) {
	float a = angle;
	float c = cos(a);
	float s = sin(a);

	vec3 axis = vec3(v);
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