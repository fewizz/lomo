#include frex:shaders/api/header.glsl
#include canvas:shaders/pipeline/pipeline.glsl

/* lomo:pipeline/sort.frag */

uniform sampler2D u_d0;
uniform sampler2D u_d1;
uniform sampler2D u_d2;
uniform sampler2D u_d3;
uniform sampler2D u_d4;
uniform sampler2D u_d5;

layout(location = 0) out vec4 out_index_to_type;
layout(location = 1) out vec4 out_type_to_index;

void main() {
	ivec2 coord = ivec2(gl_FragCoord.xy);

	float depths[6] = float[](
		texelFetch(u_d0, coord, 0).r,
		texelFetch(u_d1, coord, 0).r,
		texelFetch(u_d2, coord, 0).r,
		texelFetch(u_d3, coord, 0).r,
		texelFetch(u_d4, coord, 0).r,
		texelFetch(u_d5, coord, 0).r
	);

	bool done[6] = bool[](false, false, false, false, false, false);
	uint type_to_index[6];
	uint index_to_type[6];

	float prev_min = -1;
	//uint prev_type = 0;

	for(uint i = 0u; i < 6u; i++) {
		float current_min = 1.01;
		//uint current_type = 0u;

		for(uint x = 0u; x < 6u; x++) {
			if(done[x]) continue;

			float d = depths[x];

			if(d < current_min && d >= prev_min) {
				current_min = d;
				//current_type = x;
				index_to_type[i] = x;
			}
		}

		uint type = index_to_type[i];
		done[type] = true;
		type_to_index[type] = i;
		prev_min = current_min;
	}

	uint result_type_to_index = 0u;
	uint result_index_to_type = 0u;

	for(uint i = 0u; i < 6u; i++) {
		result_type_to_index |= type_to_index[i] << (i*4u);
		result_index_to_type |= index_to_type[i] << (i*4u);
	}

	out_index_to_type = vec4(uintBitsToFloat(result_index_to_type), 0., 0., 0.);
	out_type_to_index = vec4(uintBitsToFloat(result_type_to_index), 0., 0., 0.);
}