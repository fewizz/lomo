#include canvas:shaders/pipeline/pipeline.glsl

uniform sampler2D u_depth;

layout(location = 0) out float out_depth;

void main() {
	const int power_of_two = 2;
	const int cell_size = 1 << power_of_two;

	float min_depth = 1.0;

	for(int x = 0; x < cell_size; ++x) {
		for(int y = 0; y < cell_size; ++y) {
			ivec2 pos = ivec2(gl_FragCoord.xy) << power_of_two;
			pos += ivec2(x, y);
			int prev_lod = frxu_lod - power_of_two;
			min_depth = min(
				min_depth,
				texelFetch(u_depth, pos, prev_lod).r
			);
		}
	}

	out_depth = min_depth;
}