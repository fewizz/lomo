#include frex:shaders/api/header.glsl
#include canvas:shaders/pipeline/pipeline.glsl

/* lomo:pipeline/depth_levels.frag */

uniform sampler2DArray u_depths;

layout(location = 0) out float out_depths[2];

const int power = 2;
const int mul = 1 << power;

void main() {
	int lod = frxu_lod;
	int lod_from = lod - 1;

	ivec2 from_size = textureSize(u_depths, lod_from).xy;
	ivec2 pos = ivec2(gl_FragCoord.xy);

	float min_depths[2] = float[](1.0, 1.0);

	for(int x = 0; x < mul; x++) {
		for(int y = 0; y < mul; y++) {
			ivec2 pos_from = pos * mul + ivec2(x, y);

			if(any(greaterThanEqual(pos_from, from_size))) continue;

			for(int i = 0; i < 2; i++) {
				float d = texelFetch(u_depths, ivec3(pos_from, i), lod_from).r;
				min_depths[i] = min(min_depths[i], d);
			}
		}
	}

	for(int i = 0; i < 2; ++i) out_depths[i] = min_depths[i];
}