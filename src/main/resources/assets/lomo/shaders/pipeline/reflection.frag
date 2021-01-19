#include frex:shaders/api/header.glsl
#include lomo:shaders/lib/transform.glsl

/* lomo:pipeline/reflection.frag */

uniform sampler2D u_reflective;
uniform sampler2D u_input;
uniform sampler2D u_input_depth;

varying vec2 _cvv_texcoord;

float lenSq(vec3 v) {
    return dot(v, v);
}

//#define LOMO_DISTANCE 24

void main() {
	vec4 r = (texture2D(u_reflective, _cvv_texcoord) - 0.5) * 2;

	vec4 reflection = vec4(0);
	float ratio = 0;

	if(r != vec4(-1)) {
		mat4 view = frx_viewMatrix();
		mat4 proj = frx_projectionMatrix();

		float window_depth = texture2D(u_input_depth, _cvv_texcoord).r ;
		vec3 pixel_window_position = vec3(gl_FragCoord.xy, window_depth);
		vec3 pixel_world_position = window_to_world(pixel_window_position, proj);

		mat3 rot = mat3(view);
		vec3 ss_normal = normalize(rot * normalize(r.xyz));

		vec3 o = normalize(-pixel_world_position);
		float d = dot(o, ss_normal);
		vec3 v0 = ss_normal*d;
		vec3 res = normalize(o + (v0 - o)* 2);
		
		float ray_len = -pixel_world_position.z / 50;
		float step = 0.01;

		vec3 position = pixel_world_position + res*ray_len;

		while(true) {
			vec3 window_coord = world_to_window(position, proj);
			vec2 tex_coord = window_coord.xy / frxu_size;
			vec2 v0 = (tex_coord - 0.5);
			float as = max(abs(v0.y), abs(v0.x));
			if(as >= 0.5) break;

			float current_depth = texture2D(u_input_depth, tex_coord).r;
			float real_depth = z_window_to_world(current_depth, proj);
			if(current_depth <= 0) break;

			if(current_depth < window_coord.z) {
				//if(real_depth - position.z > step*10) break;

				as = clamp(0.5 - as, 0, 0.5)*2;
				///vec4 normal = (texture2D(u_reflective, tex_coord) - 0.5) * 2;
				//vec3 normal_ss = normalize(rot * normalize(normal.xyz));
				/*normal = vec4(position + normal_ss, 1);
				normal = proj*normal;
				normal_ss = normalize(normal.xyz);*/
				//as *= abs(normal_ss.z);*/
				//float dt = dot(normal_ss, res);
				//if(dot(normal_ss, res) >= 0) break;

				//as *= ray_len / LOMO_DISTANCE;
				as *= sqrt(1 - d*d);
				reflection = texture2D(u_input, tex_coord);//vec4(vec3(dt), 1);
				ratio = as;//as;//clamp((0.5 - distFromCenter) * 2, 0, 1);
				break;
			}

			ray_len += step;
			if(ray_len > 1000) break;

			position += res*step;
			step += step / 40;
		}

		//gl_FragData[0] = result_color;
	}
	//else {
	//	gl_FragData[0] = texture2D(u_input, _cvv_texcoord);
	//}

	gl_FragData[0] = texture2D(u_input, _cvv_texcoord) * (1-ratio) + reflection*ratio;;
}