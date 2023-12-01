// https://www.shadertoy.com/view/XlXcW4 , slightly modified
const uint k = 1103515245U;
vec2 hash22(uvec2 x ) {
	x = ((x>>8U)^x.yx)*k;
	x = ((x>>8U)^x.yx)*k;
	x = ((x>>8U)^x.yx)*k;
	
	return vec2(x)*(1.0/float(0xffffffffU));
}

vec2 hash23(uvec3 x) {
	x = ((x>>8U)^x.yzx)*k;
	x = ((x>>8U)^x.yzx)*k;
	x = ((x>>8U)^x.yzx)*k;
	
	return vec2(x.xy)*(1.0/float(0xffffffffU));
}

vec3 hash33(vec3 p3) {
	p3 = fract(p3 * vec3(.1031, .1030, .0973));
	p3 += dot(p3, p3.yxz+33.33);
	return fract((p3.xxy + p3.yxx)*p3.zyx);
}

vec3 hash34(uvec4 v) {
	v = v * 1664525u + 1013904223u;
	v.x += v.y*v.w;
	v.y += v.z*v.x;
	v.z += v.x*v.y;
	v.w += v.y*v.z;
	v ^= v >> 16u;
	v.x += v.y*v.w;
	v.y += v.z*v.x;
	v.z += v.x*v.y;
	v.w += v.y*v.z;
	return v.zyw * (1.0/float(0xffffffffU));
}

float hash13(uvec3 x) {
	return hash23(x).x;
}

float hash13(vec3 p3) {
	p3  = fract(p3 * .1031);
	p3 += dot(p3, p3.zyx + 31.32);
	return fract((p3.x + p3.y) * p3.z);
}