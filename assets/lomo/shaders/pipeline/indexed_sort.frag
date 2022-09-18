#include frex:shaders/api/header.glsl
#include canvas:shaders/pipeline/pipeline.glsl

/* lomo:pipeline/sort.frag */

uniform sampler2D u_solid_d;
uniform sampler2D u_translucent_d;
uniform sampler2D u_entity_d;
uniform sampler2D u_particle_d;
uniform sampler2D u_weather_d;
uniform sampler2D u_cloud_d;

layout(location = 0) out float out_index_to_type;
layout(location = 1) out float out_type_to_index;

void main() {
	ivec2 coord = ivec2(gl_FragCoord.xy);

	const uint layers = 5u;

	float depths[layers] = float[](
		texelFetch(u_solid_d, coord, 0).r,
		texelFetch(u_translucent_d, coord, 0).r,
		texelFetch(u_entity_d, coord, 0).r,
		texelFetch(u_particle_d, coord, 0).r,
		texelFetch(u_weather_d, coord, 0).r//,
		//texelFetch(u_cloud_d, coord, 0).r
	);

	bool done[layers] = bool[](false, false, false, false, false/*, false*/);
	uint type_to_index[layers];
	uint index_to_type[layers];

	uint begin = 0u;
	float prev_min = -1;

	for(uint i = begin; i < layers; i++) {
		float current_min = 1.01;
		for(uint x = 0u; x < layers; x++) {
			if(done[x]) continue;

			float d = depths[x];

			if(d < current_min && d >= prev_min) {
				current_min = d;
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

	for(uint i = 0u; i < layers; i++) {
		result_type_to_index |= type_to_index[i] << (i*4u);
		result_index_to_type |= index_to_type[i] << (i*4u);
	}

	out_index_to_type = uintBitsToFloat(result_index_to_type);
	out_type_to_index = uintBitsToFloat(result_type_to_index);
}