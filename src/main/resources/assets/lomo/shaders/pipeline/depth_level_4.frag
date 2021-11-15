#include frex:shaders/api/header.glsl
#include canvas:shaders/pipeline/pipeline.glsl

/* lomo:pipeline/depth_levels_4.frag */

uniform sampler2D u_depth_0;
uniform sampler2D u_depth_1;

out vec4 o[2];

float depth(sampler2D s) {
	int lod = frxu_lod;
	int lod_from = lod - 1;
	float min_depth = 1;

	ivec2 size = textureSize(s, 0);

	ivec2 coord = ivec2(gl_FragCoord.xy);
	if(any(greaterThanEqual(coord << (2*lod), size))) return 0.0;//discard;

	for(int x = 0; x < 4; x++) {
		for(int y = 0; y < 4; y++) {
			ivec2 v = coord * 4 + ivec2(x, y);

			if(any(greaterThanEqual(v << (2*lod_from), size))) continue;

			float d = texelFetch(s, v, lod_from).r;
			min_depth = min(min_depth, d);
		}
	}

	return min_depth;
}

void main() {
	o[0] = vec4(depth(u_depth_0));
	o[1] = vec4(depth(u_depth_1));
}