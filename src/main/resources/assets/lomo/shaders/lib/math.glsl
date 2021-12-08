/* lomo:lib/math.glsl */

float max4(float a, float b, float c, float d) {
	return max(max(a, b), max(c, d));
}

vec3 pow3(vec3 v, float x) {
	return vec3(pow(v.x, x), pow(v.y, x), pow(v.z, x));
}

vec3 pow3(float x, vec3 p) {
	return vec3(pow(x, p.x), pow(x, p.y), pow(x, p.z));
}