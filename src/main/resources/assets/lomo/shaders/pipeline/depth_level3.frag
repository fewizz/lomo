#include frex:shaders/api/header.glsl
#include canvas:shaders/pipeline/pipeline.glsl

/* lomo:shaders/depth_levels.frag */

uniform sampler2D u_depth;

in vec2 _cvv_texcoord;
out vec4 out_color;

void main() {
	int lod_from = frxu_lod - 1;

	float min_depth = 1;
	int mul = int( pow(3, lod_from) );

	ivec2 orig_size = textureSize(u_depth, 0);

	if(gl_FragCoord.x * 3 * mul >= orig_size.x || gl_FragCoord.y * 3 * mul >= orig_size.y) discard;

	for(int x = 0; x < 3; x++) {
		for(int y = 0; y < 3; y++) {
			ivec2 v = ivec2(gl_FragCoord.xy)*3 + ivec2(x, y);

			if(v.x * mul >= orig_size.x || v.y * mul >= orig_size.y) continue;

			float d = texelFetch(u_depth, v, lod_from).r;
			min_depth = min(min_depth, d);
		}
	}

	out_color = vec4(min_depth, 0, 0, 1);
}