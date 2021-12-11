#include frex:shaders/api/header.glsl

/* lomo:pipeline/copy_to_array.frag */

uniform sampler2D u_solid;
uniform sampler2D u_solid_before_hand;
uniform sampler2D u_translucent;
uniform sampler2D u_entity;
uniform sampler2D u_particle;
uniform sampler2D u_weather;
uniform sampler2D u_cloud;

uniform sampler2D u_index_to_type;

layout(location = 0) out vec4 out_values[3];

void main() {
	ivec2 coord = ivec2(gl_FragCoord.xy);

	vec4 values[7] = vec4[] (
		texelFetch(u_solid, coord, 0),
		texelFetch(u_solid_before_hand, coord, 0),
		texelFetch(u_translucent, coord, 0),
		texelFetch(u_entity, coord, 0),
		texelFetch(u_particle, coord, 0),
		texelFetch(u_weather, coord, 0),
		texelFetch(u_cloud, coord, 0)
	);

	uint index_to_type0 = floatBitsToUint(texelFetch(u_index_to_type, coord, 0).r);

	uint index_to_type[7];
	for(uint i = 0u; i < 7u; i++) {
		index_to_type[i] = (index_to_type0 >> (4u*i)) & 0xFu;
	}

	out_values[0] = values[index_to_type[0]];

	uint i = 0u;
	while(index_to_type[i] != 0u) ++i;
	out_values[1] = values[index_to_type[i]];

	i = 0u;
	while(index_to_type[i] != 0u && index_to_type[i] != 2u) ++i;
	out_values[2] = values[index_to_type[i]];
}