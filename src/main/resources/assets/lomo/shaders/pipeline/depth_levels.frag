#include frex:shaders/api/header.glsl
#include canvas:shaders/pipeline/pipeline.glsl

/* lomo:pipeline/depth_levels.frag */

uniform sampler2D u_depths;

layout(location = 0) out float out_depths;

const int power = 2;
const int mul = 1 << power;

void main() {
	int lod = frxu_lod;
	int lod_from = lod - 1;

	ivec2 from_size = textureSize(u_depths, lod_from).xy;
	ivec2 pos = ivec2(gl_FragCoord.xy);

	float min_depths = 1.0;

	for(int x = 0; x < mul; x++) {
		for(int y = 0; y < mul; y++) {
			ivec2 pos_from = pos * mul + ivec2(x, y);

			if(any(greaterThanEqual(pos_from, from_size))) continue;

			float d = texelFetch(u_depths, pos_from, lod_from).r;
			min_depths = min(min_depths, d);
		}
	}

	out_depths = min_depths;
}