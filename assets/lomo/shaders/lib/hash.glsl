/* lomo:lib/hash.glsl */

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
	x = ((x>>8U)^x.xyz)*k;
	x = ((x>>8U)^x.zxy)*k;
	
	return vec2(x.xy + x.z)*(1.0/float(0xffffffffU));
}

float hash13(uvec3 x) {
	return hash23(x).x;
}