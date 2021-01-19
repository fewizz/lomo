#include frex:shaders/api/header.glsl
#include lomo:shaders/lib/transform.glsl

/* lomo:pipeline/reflection.frag */

uniform sampler2D u_reflective;
uniform sampler2D u_input;
uniform sampler2D u_input_depth;

varying vec2 _cvv_texcoord;

#define VIEW_DIST 10

float lenSq(vec3 v) {
    return dot(v, v);
}

void main() {
	vec4 r = (texture2D(u_reflective, _cvv_texcoord) - 0.5) * 2;

	vec4 reflection = vec4(0);
	float ratio = 0;

	if(r != vec4(-1)) {
		mat4 view = frx_viewMatrix();
		mat4 proj = frx_projectionMatrix();

		float window_depth = vec4(texture2D(u_input_depth, _cvv_texcoord)).r ;
		vec3 pixel_window_position = vec3(gl_FragCoord.xy, window_depth);
		vec3 pixel_world_position = window_to_world(pixel_window_position, proj);

		mat3 rot = mat3(view);
		vec3 ss_normal = normalize(rot * normalize(r.xyz));

		vec3 o = normalize(-pixel_world_position);
		//o.z = -o.z;
		float d = dot(o, ss_normal);
		vec3 v0 = ss_normal*d;
		vec3 res = normalize(o + (v0 - o)* 2);

		//vec4 result_color = vec4(0);
		
		float ray_len = 0.35;

		d = (d - 0.1)*10;
		//d = d;

		while(d > 0 || true) {
			vec3 position = pixel_world_position + res*ray_len;

			vec3 window_coord = world_to_window(position, proj);
			vec2 tex_coord = window_coord.xy / frxu_size;
			float current_depth = vec4(texture2D(u_input_depth, tex_coord)).r;

			if(current_depth < window_coord.z) {
				reflection = texture2D(u_input, tex_coord);
				ratio = d;
				break;
			}

			if(tex_coord.x > 1 || tex_coord.y > 1 || tex_coord.x < 0 || tex_coord.y < 0 || ray_len > 10) break;

			ray_len += 0.35;
		}

		//gl_FragData[0] = result_color;
	}
	//else {
	//	gl_FragData[0] = texture2D(u_input, _cvv_texcoord);
	//}

	gl_FragData[0] = texture2D(u_input, _cvv_texcoord) * (1-ratio) + reflection*ratio;;
}