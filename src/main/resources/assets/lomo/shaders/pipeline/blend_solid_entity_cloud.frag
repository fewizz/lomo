/* lomo:pipeline/blend_base.frag */

uniform sampler2D u_solid_c;
uniform sampler2D u_solid_n;
uniform sampler2D u_solid_e;
uniform sampler2D u_solid_d;

uniform sampler2D u_entity_c;
uniform sampler2D u_entity_n;
uniform sampler2D u_entity_e;
uniform sampler2D u_entity_d;

uniform sampler2D u_cloud_c;
uniform sampler2D u_cloud_d;

uniform sampler2D u_indices;

layout(location = 0) out out_color;
layout(location = 1) out out_normal;
layout(location = 2) out out_extra;
layout(location = 3) out out_depth;

void main() {
	
}