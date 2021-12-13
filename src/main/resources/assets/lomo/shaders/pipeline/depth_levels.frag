#include frex:shaders/api/header.glsl
#include canvas:shaders/pipeline/pipeline.glsl

/* lomo:pipeline/depth_levels_4.frag */

uniform sampler2DArray u_depths;

layout(location = 0) out vec4 out_depths[3];

const int power = 2;
const int mul = 1 << power;

void main() {
	int lod = frxu_lod;
	int lod_from = lod - 1;

	ivec2 size = textureSize(u_depths, 0).xy;

	ivec2 coord = ivec2(gl_FragCoord.xy);
	if(any(greaterThanEqual(coord << (power*lod), size))) discard;

	float min_depths[3] = float[](1, 1, 1);

	for(int x = 0; x < mul; x++) {
		for(int y = 0; y < mul; y++) {
			ivec2 v = coord * mul + ivec2(x, y);

			if(any(greaterThanEqual(v << (lod_from*power), size))) continue;

			for(int i = 0; i < 3; i++) {
				float d = texelFetch(u_depths, ivec3(v, i), lod_from).r;
				min_depths[i] = min(min_depths[i], d);
			}
		}
	}

	for(int i = 0; i < 3; ++i) out_depths[i] = vec4(min_depths[i]);
}