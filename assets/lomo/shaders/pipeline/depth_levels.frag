#include frex:shaders/api/header.glsl
#include canvas:shaders/pipeline/pipeline.glsl

/* lomo:pipeline/depth_levels.frag */

uniform sampler2DArray u_depths;

layout(location = 0) out float out_depths;

const int power = 2;
const int len = 1 << power;

void main() {
	int layer = frxu_layer;
	int layer_from = layer - 1;

	ivec2 from_size = textureSize(u_depths, 0).xy;
	ivec2 pos = ivec2(gl_FragCoord.xy);
	int mul = 1 << (layer * power);//int(pow(len, layer));
	int mul_from = 1 << (layer_from * power);
	pos -= pos % mul;

	float min_depths = 1.0;

	for(int x = 0; x < len; x++) {
		for(int y = 0; y < len; y++) {
			ivec2 pos_from = pos + ivec2(x, y) * mul_from;

			if(any(greaterThanEqual(pos_from, from_size))) continue;

			float d = texelFetch(u_depths, ivec3(pos_from, layer_from), 0).r;
			min_depths = min(min_depths, d);
		}
	}

	out_depths = min_depths;
}