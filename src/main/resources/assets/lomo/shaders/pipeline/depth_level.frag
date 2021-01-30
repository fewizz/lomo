#include frex:shaders/api/header.glsl
#include canvas:shaders/pipeline/pipeline.glsl

/* lomo:shaders/depth_levels.frag */

uniform sampler2D u_depth;

varying vec2 _cvv_texcoord;

void main() {
	int lod_from = frxu_lod - 1;

	float mn = 1;
	int mul = int( pow(2, lod_from*2) );

	ivec2 orig_size = textureSize(u_depth, 0);

	if(gl_FragCoord.x * 4 * mul >= orig_size.x || gl_FragCoord.y * 4 * mul >= orig_size.y) discard;

	for(int x = 0; x < 4; x++) {
		for(int y = 0; y < 4; y++) {
			ivec2 v = ivec2(gl_FragCoord.xy)*4 + ivec2(x, y);

			if(v.x * mul >= orig_size.x || v.y * mul >= orig_size.y) continue;

			float d = texelFetch(u_depth, v, lod_from).r;
			mn = min(mn, d);
		}
	}

	gl_FragData[0] = vec4(mn/*-0.001*float(frxu_lod)*/, 0, 0, 1);
}