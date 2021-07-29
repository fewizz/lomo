#include frex:shaders/api/header.glsl
#extension GL_ARB_explicit_attrib_location : require
#include canvas:shaders/pipeline/pipeline.glsl

/* lomo:depth_levels_4.frag */

uniform sampler2D u_depth_0;
uniform sampler2D u_depth_1;

in vec2 vs_uv;

layout(location = 0) out vec4 out_depth_0;
layout(location = 1) out vec4 out_depth_1;

float depth(sampler2D s) {
	int lod = frxu_lod;
	int lod_from = lod - 1;
	float min_depth = 1;

	int power = 4;
	int max_val = 1 << power;

	ivec2 size = textureSize(s, 0);

	ivec2 coord = ivec2(gl_FragCoord.xy);
	if(any(greaterThanEqual(coord << (power*lod), size))) discard;

	for(int x = 0; x < max_val; x++) {
		for(int y = 0; y < max_val; y++) {
			ivec2 v = coord * max_val + ivec2(x, y);

			if(any(greaterThanEqual(v << (power*lod_from), size))) continue;

			float d = texelFetch(s, v, lod_from).r;
			min_depth = min(min_depth, d);
		}
	}

	return min_depth;
}

void main() {
	out_depth_0 = vec4(depth(u_depth_0));
	out_depth_1 = vec4(depth(u_depth_1));
}